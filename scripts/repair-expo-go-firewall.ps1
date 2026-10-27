[CmdletBinding()]
param([switch]$Apply, [switch]$Undo)

# Default is a read-only plan. Apply/Undo require an administrator PowerShell.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupFile = Join-Path $projectRoot '.expo\expo-go-firewall-backup.json'
$resultFile = Join-Path $projectRoot '.expo\expo-go-firewall-result.json'
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$ruleName = 'Waylo-ExpoGo-8081-LocalWiFi'
$firewall = New-Object -ComObject HNetCfg.FwPolicy2
$port = 8081

function Write-Result($value) {
    $value | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resultFile -Encoding UTF8
    $value | Format-List
}

if (-not $Apply -and -not $Undo) {
    $blocked = @($firewall.Rules | Where-Object {
        $_.Enabled -and $_.Direction -eq 1 -and $_.Protocol -eq 6 -and
        $_.Profiles -eq 4 -and $_.Action -eq 0 -and $_.ApplicationName -ieq $nodePath
    })
    [pscustomobject]@{
        Mode = 'Read-only plan'; Program = $nodePath; PublicDefaultInbound = $firewall.DefaultInboundAction(4)
        MatchingPublicTCPBlocks = $blocked.Count; Port = $port
        Change = 'Keep the Node TCP block for every other port. Allow TCP 8081 from LocalSubnet on Wi-Fi only.'
        Backup = $backupFile; Undo = 'Run this script with -Undo in an administrator PowerShell.'
    } | Format-List
    exit 0
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Apply/Undo require an administrator PowerShell. No firewall setting was changed.'
}

try {
    if ($Undo) {
        $saved = Get-Content -LiteralPath $backupFile -Raw | ConvertFrom-Json
        if ($saved.Program -ine $nodePath -or $saved.RuleName -ne $ruleName -or $saved.Port -ne $port) { throw 'Backup does not match this repair.' }
        Set-NetFirewallRule -Name $saved.BlockRule -LocalPort $saved.OriginalLocalPorts | Out-Null
        if (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue) { Remove-NetFirewallRule -Name $ruleName }
        Write-Result ([pscustomobject]@{ Status = 'undone'; Port = $port; Program = $nodePath; CheckedAt = (Get-Date).ToString('o') })
        exit 0
    }

    if (-not $firewall.FirewallEnabled(4) -or $firewall.DefaultInboundAction(4) -ne 0) {
        throw 'Expected an enabled Public firewall with default inbound Block. No change was made.'
    }
    $wifi = Get-NetConnectionProfile -InterfaceAlias 'Wi-Fi'
    if ($wifi.NetworkCategory -ne 'Public') { throw 'This repair targets the verified Public Wi-Fi profile only.' }
    if (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue) { throw 'The Waylo rule already exists; review it or undo before applying again.' }

    $nodeRules = @(Get-NetFirewallRule -PolicyStore PersistentStore -Enabled True -Direction Inbound | Where-Object {
        $_.Profile.ToString() -eq 'Public' -and (($_ | Get-NetFirewallApplicationFilter).Program -ieq $nodePath)
    })
    $publicAllows = @($nodeRules | Where-Object { $_.Action -eq 'Allow' })
    if ($publicAllows.Count -gt 0) { throw 'Unexpected Public allow rules exist for this Node executable; refusing to broaden their access.' }
    $blocks = @($nodeRules | Where-Object {
        $ports = $_ | Get-NetFirewallPortFilter
        $_.Action -eq 'Block' -and $ports.Protocol -eq 'TCP' -and @($ports.LocalPort).Count -eq 1 -and $ports.LocalPort -eq 'Any'
    })
    if ($blocks.Count -ne 1) { throw 'Expected exactly one verified all-port Public Node TCP block; refusing an ambiguous repair.' }

    $backup = [pscustomobject]@{ Program = $nodePath; Port = $port; RuleName = $ruleName; BlockRule = $blocks[0].Name; OriginalLocalPorts = @('Any'); CreatedAt = (Get-Date).ToString('o') }
    if (Test-Path -LiteralPath $backupFile) { throw 'An earlier backup exists. Review or undo it before another repair.' }
    $backup | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $backupFile -Encoding UTF8
    try {
        # Keep the existing block on every TCP port except the single Expo port.
        Set-NetFirewallRule -Name $blocks[0].Name -LocalPort @('1-8080', '8082-65535') | Out-Null
        New-NetFirewallRule -Name $ruleName -DisplayName 'Waylo Expo Go - local Wi-Fi TCP 8081' -Direction Inbound -Action Allow -Enabled True -Profile Public -Program $nodePath -Protocol TCP -LocalPort $port -RemoteAddress LocalSubnet -InterfaceAlias 'Wi-Fi' -EdgeTraversalPolicy Block | Out-Null
    } catch {
        Set-NetFirewallRule -Name $blocks[0].Name -LocalPort Any | Out-Null
        throw
    }
    $created = Get-NetFirewallRule -Name $ruleName
    $createdPort = $created | Get-NetFirewallPortFilter
    $createdAddress = $created | Get-NetFirewallAddressFilter
    Write-Result ([pscustomobject]@{ Status = 'applied'; Program = $nodePath; Port = $createdPort.LocalPort; RemoteAddress = $createdAddress.RemoteAddress; Profile = $created.Profile.ToString(); FirewallEnabled = $firewall.FirewallEnabled(4); CheckedAt = (Get-Date).ToString('o') })
} catch {
    Write-Result ([pscustomobject]@{ Status = 'failed'; Error = $_.Exception.Message; CheckedAt = (Get-Date).ToString('o') })
    exit 1
}
