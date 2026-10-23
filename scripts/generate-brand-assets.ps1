$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$wayloProject = Split-Path -Parent $PSScriptRoot
$wayloImages = Join-Path $wayloProject 'assets/images'

# The same original paths as src/components/waylo-mark.tsx, rasterised for native launch.
function Write-WayloImage([string]$Name, [int]$Size, [bool]$Background, [bool]$Monochrome, [bool]$Mark = $true) {
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    if ($Background) { $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#153E35')) }
    else { $graphics.Clear([System.Drawing.Color]::Transparent) }
    $graphics.ScaleTransform(($Size / 100.0), ($Size / 100.0))
    if ($Mark) {
        $ivory = [System.Drawing.ColorTranslator]::FromHtml('#FAF9F6')
        $accent = if ($Monochrome) { $ivory } else { [System.Drawing.ColorTranslator]::FromHtml('#D6BD86') }
        $pen = New-Object System.Drawing.Pen($ivory, 9)
        $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddBezier(24,75,29,60,41,48,55,47)
        $path.AddBezier(55,47,65,46,71,52,68,59)
        $path.AddBezier(68,59,66,64,59,66,55,62)
        $path.AddBezier(55,62,49,56,56,42,72,25)
        $graphics.DrawPath($pen, $path)
        $points = [System.Drawing.PointF[]]@(
            [System.Drawing.PointF]::new(64,33), [System.Drawing.PointF]::new(82,13),
            [System.Drawing.PointF]::new(78,38), [System.Drawing.PointF]::new(71,31),
            [System.Drawing.PointF]::new(63,33)
        )
        $brush = New-Object System.Drawing.SolidBrush($accent)
        $outline = New-Object System.Drawing.Pen($ivory, 2)
        $outline.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $graphics.FillPolygon($brush, $points)
        $graphics.DrawPolygon($outline, $points)
        $graphics.FillEllipse($brush, 19,70,10,10)
        $graphics.DrawEllipse($outline, 19,70,10,10)
        $path.Dispose(); $pen.Dispose(); $outline.Dispose(); $brush.Dispose()
    }
    $bitmap.Save((Join-Path $wayloImages $Name), [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose(); $bitmap.Dispose()
}

Write-WayloImage 'splash-icon.png' 512 $false $false
Write-WayloImage 'icon.png' 1024 $true $false
Write-WayloImage 'android-icon-foreground.png' 432 $false $false
Write-WayloImage 'android-icon-monochrome.png' 432 $false $true
Write-WayloImage 'android-icon-background.png' 432 $true $false $false
Write-WayloImage 'favicon.png' 64 $true $false
Write-Output 'Generated six Waylo native identity assets.'
