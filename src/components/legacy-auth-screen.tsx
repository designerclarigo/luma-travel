import { Text } from './language-provider';
import { useCloud } from './cloud-provider';
import { useWayloLaunch } from './waylo-launch';
import { MotionPressable } from './motion-pressable';
import { WayloMark } from './waylo-mark';
import { ActionButton, Icon, Screen, Sheet, TravelGate, ui } from './travel-ui';
import { palette, typography } from '@/constants/waylo';
import { useDurableAction } from '@/hooks/use-durable-action';
import { accountIdentity, authMessage, cleanEmail, loginIssue, passwordIssue, registrationIssue, validEmail } from '@/lib/auth-policy';
import { cloudConfigured, requireCloud } from '@/lib/cloud-client';
import { registerAccount, resendConfirmation, sendRecovery } from '@/lib/auth-service';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, TextInput, type TextInputProps, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export type AuthMode = 'login' | 'signup' | 'verify' | 'forgot' | 'reset';
const copy: Record<AuthMode, { eyebrow: string; title: string; body: string }> = {
  login: { eyebrow: 'YOUR NEXT CHAPTER', title: 'Good to have\nyou back.', body: 'Your shared plans, familiar places and little travel details are waiting.' },
  signup: { eyebrow: 'A WORLD OF POSSIBILITY', title: 'Every journey\nstarts with you.', body: 'Create your Waylo account. Bring a little more ease to getting away.' },
  verify: { eyebrow: 'ONE LITTLE STEP', title: 'A note in\nyour inbox.', body: 'Open the newest Waylo confirmation email to make this account yours.' },
  forgot: { eyebrow: 'LET’S FIND YOUR WAY BACK', title: 'A fresh start.\nSame adventures.', body: 'We’ll send a recovery link so you can choose a new password.' },
  reset: { eyebrow: 'BACK TO WHAT MATTERS', title: 'A new password.\nA lighter start.', body: 'Choose a new password, then sign in to continue your story.' },
};

function AuthField({ label, value, onChangeText, password = false, hint, ...props }: TextInputProps & { label: string; password?: boolean; hint?: string }) {
  const [focused, setFocused] = useState(false), [shown, setShown] = useState(false);
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <View style={[s.inputRow, focused && s.inputFocused]}>
      <TextInput {...props} accessibilityLabel={label} value={value} onChangeText={onChangeText} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        secureTextEntry={password && !shown} autoCorrect={false} spellCheck={false} placeholderTextColor={palette.muted} style={s.input} />
      {password && <MotionPressable accessibilityRole="button" accessibilityLabel={`${shown ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onPress={() => setShown((v) => !v)} style={s.show}><Text style={s.showLabel}>{shown ? 'Hide' : 'Show'}</Text></MotionPressable>}
    </View>
    {hint && <Text style={ui.small}>{hint}</Text>}
  </View>;
}
function AuthLink({ children, onPress, disabled = false }: { children: string; onPress: () => void; disabled?: boolean }) {
  return <MotionPressable accessibilityRole="button" accessibilityLabel={children} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={s.link}><Text style={s.linkText}>{children}</Text></MotionPressable>;
}
export function LegacyAuthScreen({ mode = 'login' }: { mode?: AuthMode }) { return <TravelGate><AuthContent key={mode} mode={mode} /></TravelGate>; }
function AuthContent({ mode }: { mode: AuthMode }) {
  const cloud = useCloud(), action = useDurableAction();
  const params = useLocalSearchParams<{ invite?: string; updated?: string }>();
  const { reducedMotion } = useWayloLaunch(); const { width, fontScale } = useWindowDimensions();
  const [name, setName] = useState(''), [email, setEmail] = useState(cloud.pendingEmail || (mode === 'forgot' ? cloud.session?.user.email : '') || '');
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [code, setCode] = useState('');
  const [sent, setSent] = useState(mode === 'verify'), [showCode, setShowCode] = useState(false), [cooldown, setCooldown] = useState(0), [logoutOpen, setLogoutOpen] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const identity = accountIdentity(cloud.profile, cloud.session?.user.email);
  const recoveryValid = !!cloud.recovery && cloud.recovery.userId === cloud.session?.user.id;
  const invite = typeof params.invite === 'string' && /^[a-f0-9]{64}$/i.test(params.invite) ? params.invite : undefined;
  const go = (pathname: '/login' | '/sign-up' | '/verify-email' | '/forgot-password' | '/reset-password' | '/account', replace = false) => {
    if (action.busy) return; Keyboard.dismiss();
    const target = { pathname, params: invite ? { invite } : {} };
    if (replace) router.replace(target); else router.push(target);
  };
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown((v) => Math.max(0, v - 1)), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const emailReady = () => { if (!validEmail(cleanEmail(email))) { action.setError('Enter the email address you used for your account.'); return false; } return true; };
  const emailRequest = async (recovery = false) => {
    if (!emailReady() || cooldown) return;
    await action.run(async () => {
      const result = recovery ? await sendRecovery(email) : await resendConfirmation(email);
      if (result.error) throw new Error(authMessage(result.error));
      cloud.setPendingEmail(cleanEmail(email)); setSent(true); setCooldown(60);
      action.setMessage(recovery ? 'If an account uses this email, its recovery link has been requested. Check your inbox and spam folder.' : 'A confirmation email has been requested. Open the newest link in your inbox.');
    });
  };
  const verifyCode = async () => {
    if (!emailReady()) return;
    if (!/^\d{6,10}$/.test(code.trim())) { action.setError('Enter the complete code from your email, if one was provided.'); return; }
    await action.run(async () => {
      const result = await requireCloud().auth.verifyOtp({ email: cleanEmail(email), token: code.trim(), type: mode === 'forgot' ? 'recovery' : 'email' });
      if (result.error) throw new Error(authMessage(result.error));
      setCode('');
      if (!result.data.user || !result.data.session) throw new Error('Request a new email link to finish verification.');
      if (mode === 'forgot') { cloud.authorizeRecovery(result.data.user.id); router.replace('/reset-password'); }
      else router.replace('/account');
    });
  };
  const submit = async () => {
    const issue = mode === 'signup' ? registrationIssue({ fullName: name, email, password, confirmation }) : mode === 'reset' ? passwordIssue(password, confirmation) : loginIssue(email, password);
    if (issue) { action.setError(issue); return; }
    Keyboard.dismiss();
    await action.run(async () => {
      if (mode === 'reset') {
        if (!recoveryValid || !cloud.recovery || cloud.recovery.expiresAt <= Date.now()) throw new Error('Your recovery session expired. Request a new password reset email.');
        const result = await requireCloud().auth.updateUser({ password });
        if (result.error) throw new Error(authMessage(result.error));
        setPassword(''); setConfirmation(''); setPasswordSaved(true);
        await cloud.logout(); router.replace({ pathname: '/login', params: { updated: '1' } }); return;
      }
      const result = mode === 'signup' ? await registerAccount(name, email, password) : await requireCloud().auth.signInWithPassword({ email: cleanEmail(email), password });
      if (result.error) {
        if (result.error.code === 'email_not_confirmed') { cloud.setPendingEmail(cleanEmail(email)); router.replace({ pathname: '/verify-email', params: invite ? { invite } : {} }); return; }
        throw new Error(authMessage(result.error));
      }
      cloud.setPendingEmail(cleanEmail(email)); setPassword(''); setConfirmation('');
      if (mode === 'signup' && !result.data.session) router.replace({ pathname: '/verify-email', params: invite ? { invite } : {} });
      else router.replace({ pathname: '/account', params: invite ? { invite } : {} });
    });
  };
  const alreadyConfirmed = mode === 'verify' && !!cloud.session?.user.email_confirmed_at && (!cloud.pendingEmail || cleanEmail(cloud.session.user.email ?? '') === cleanEmail(cloud.pendingEmail));
  const alreadySignedIn = (mode === 'login' || mode === 'signup') && !!cloud.session;
  const closedRecovery = mode === 'reset' && !recoveryValid;
  const details = alreadyConfirmed ? { eyebrow: 'YOU’RE ALL SET', title: 'A little closer.\nTo everywhere.', body: 'Your email is verified. Your next chapter is ready when you are.' } : copy[mode];
  return <Screen scroll><View style={[s.root, width < 360 && { paddingHorizontal: 16 }]}>
    <View style={s.brandRow}><View style={s.brand}><View style={s.mark}><WayloMark size={32} color={palette.pine} /></View><Text localize={false} style={s.wordmark}>waylo</Text></View><AuthLink disabled={action.busy} onPress={() => { Keyboard.dismiss(); router.navigate('/home'); }}>Explore</AuthLink></View>
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(240)} style={s.main}>
      <View style={s.heading}><Text style={s.eyebrow}>{details.eyebrow}</Text><Text accessibilityRole="header" style={[s.title, (width < 360 || fontScale > 1.3) && { fontSize: 42, lineHeight: 48 }]}>{details.title}</Text><Text style={ui.body}>{details.body}</Text></View>
      <View style={[s.form, width >= 560 && s.desktopForm]}>
        {!cloudConfigured && <View style={s.notice}><Icon name="cloud" /><Text style={ui.body}>Account services aren’t configured in this build. Your device trips and offline tools are still available.</Text></View>}
        {!!cloud.sessionError && <Text accessibilityRole="alert" style={ui.error}>{cloud.sessionError}</Text>}
        {!!cloud.sessionNotice && <Text accessibilityLiveRegion="polite" style={s.noticeText}>{cloud.sessionNotice}</Text>}
        {params.updated === '1' && <View style={s.success}><Icon name="check" /><Text style={s.noticeText}>Password updated. Sign in with your new password.</Text></View>}
        {cloud.loading ? <View style={s.loading} accessibilityState={{ busy: true }}><ActivityIndicator color={palette.pine} /><Text style={ui.small}>Restoring your secure sign-in…</Text></View> : alreadySignedIn ? <>
          <View style={s.success}><Icon name="check" /><View style={s.flex}><Text style={s.label}>You’re signed in</Text><Text localize={false} style={ui.body}>{identity.name}</Text></View></View>
          <ActionButton onPress={() => go(recoveryValid ? '/reset-password' : '/account', true)}>{recoveryValid ? 'Continue password reset' : 'Go to my account'}</ActionButton>
          <AuthLink onPress={() => setLogoutOpen(true)}>Use another account</AuthLink>
        </> : passwordSaved ? <><View style={s.success}><Icon name="check" /><Text style={s.noticeText}>Your password was updated. Finish signing out of this device, then sign in with your new password.</Text></View><ActionButton busy={action.busy} onPress={() => void action.run(async () => { await cloud.logout(); router.replace({ pathname: '/login', params: { updated: '1' } }); })}>Finish signing out</ActionButton></> : alreadyConfirmed ? <><View style={s.success}><Icon name="shield" /><Text style={s.noticeText}>Email confirmed. Welcome to Waylo.</Text></View><ActionButton onPress={() => go('/account', true)}>Continue to my account</ActionButton></> : closedRecovery ? <>
          <View style={s.notice}><Icon name="shield" /><Text style={ui.body}>Open the newest recovery link on this device. It gives you a short, verified session to choose a new password.</Text></View><ActionButton onPress={() => go('/forgot-password', true)}>Request a recovery link</ActionButton><AuthLink onPress={() => go('/login', true)}>Back to sign in</AuthLink>
        </> : mode === 'verify' || mode === 'forgot' && sent ? <>
          <View style={s.inboxIcon}><Icon name={mode === 'forgot' ? 'shield' : 'check'} size={30} /></View>
          <Text style={ui.body}>{mode === 'forgot' ? 'If this email has an account, open its recovery link on this device.' : 'Confirm the email you used to register. Opening the link on another device? Return here and sign in afterwards.'}</Text>
          <AuthField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" editable={!action.busy} maxLength={254} />
          <ActionButton secondary busy={action.busy} disabled={cooldown > 0} onPress={() => void emailRequest(mode === 'forgot')}>{cooldown ? `Request another email in ${cooldown}s` : 'Resend email'}</ActionButton>
          <AuthLink onPress={() => setShowCode((v) => !v)}>{showCode ? 'Use the email link instead' : 'My email includes a verification code'}</AuthLink>
          {showCode && <><Text style={ui.small}>Only use this option if the email you received contains a numeric code.</Text><AuthField label="Email verification code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" autoCapitalize="none" maxLength={10} editable={!action.busy} /><ActionButton busy={action.busy} onPress={() => void verifyCode()}>Verify code</ActionButton></>}
          <AuthLink onPress={() => go('/login', true)}>Already confirmed? Sign in</AuthLink>
        </> : mode === 'forgot' ? <>
          <AuthField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" maxLength={254} editable={!action.busy} returnKeyType="send" onSubmitEditing={() => void emailRequest(true)} />
          <ActionButton busy={action.busy} onPress={() => void emailRequest(true)}>Send recovery link</ActionButton><AuthLink onPress={() => go('/login', true)}>Back to sign in</AuthLink>
        </> : <>
          {mode === 'signup' && <AuthField label="Full name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" textContentType="name" placeholder="Your name" maxLength={100} editable={!action.busy} />}
          {mode !== 'reset' && <AuthField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" maxLength={254} editable={!action.busy} />}
          <AuthField label={mode === 'reset' ? 'New password' : 'Password'} password value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} textContentType={mode === 'login' ? 'password' : 'newPassword'} maxLength={128} editable={!action.busy} returnKeyType={mode === 'login' ? 'go' : 'next'} onSubmitEditing={mode === 'login' ? () => void submit() : undefined} hint={mode !== 'login' ? 'Use at least 8 characters. A longer, unique password is a good start.' : undefined} />
          {mode === 'login' ? <View style={s.rightLink}><AuthLink onPress={() => { cloud.setPendingEmail(cleanEmail(email)); go('/forgot-password'); }}>Forgot password?</AuthLink></View> : <AuthField label={mode === 'reset' ? 'Confirm new password' : 'Confirm password'} password value={confirmation} onChangeText={setConfirmation} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" maxLength={128} editable={!action.busy} returnKeyType="go" onSubmitEditing={() => void submit()} />}
          <ActionButton busy={action.busy} onPress={() => void submit()}>{mode === 'signup' ? 'Create my account' : mode === 'reset' ? 'Save new password' : 'Sign in'}</ActionButton>
          {mode !== 'reset' && <View style={s.switchRow}><Text style={ui.small}>{mode === 'login' ? 'New to Waylo?' : 'Already have an account?'}</Text><AuthLink onPress={() => go(mode === 'login' ? '/sign-up' : '/login', true)}>{mode === 'login' ? 'Create an account' : 'Sign in'}</AuthLink></View>}
        </>}
        {!!action.error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{action.error}</Text>}
        {!!action.message && <Text accessibilityLiveRegion="polite" style={s.noticeText}>{action.message}</Text>}
      </View>
      <View style={s.privacy}><Icon name="shield" size={18} /><Text style={[ui.small, s.flex]}>Your device trips stay with you. You choose which plans to save to the cloud.</Text></View>
      <View style={s.footer}><View style={s.line} /><Text style={s.footerText}>A LIGHTER WAY TO GET AWAY</Text><View style={s.line} /></View>
    </Animated.View>
  </View><Sheet title="Switch your Waylo account?" visible={logoutOpen} onClose={() => { if (!action.busy) setLogoutOpen(false); }}><Text style={ui.body}>This signs out of Waylo on this device. Your local trips and packing lists stay saved.</Text>{!!action.error && <Text style={ui.error}>{action.error}</Text>}<ActionButton busy={action.busy} onPress={() => void action.run(async () => { await cloud.logout(); setLogoutOpen(false); })}>Sign out of this account</ActionButton></Sheet></Screen>;
}

const s = StyleSheet.create({
  root: { width: '100%', maxWidth: 528, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingTop: 16, paddingBottom: 24 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 8 }, mark: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.sage }, wordmark: { fontFamily: typography.editorial, fontSize: 34, lineHeight: 40, color: palette.pine },
  main: { gap: 24 }, heading: { gap: 16 }, eyebrow: { fontFamily: typography.medium, fontSize: 11, lineHeight: 16, letterSpacing: 1.5, color: palette.pine }, title: { fontFamily: typography.editorial, fontSize: 54, lineHeight: 56, color: palette.ink },
  form: { gap: 24 }, desktopForm: { backgroundColor: palette.white, borderWidth: 1, borderColor: palette.border, borderRadius: 24, padding: 24, boxShadow: '0 8px 32px rgba(21,62,53,0.035)' },
  field: { gap: 8 }, label: { fontFamily: typography.medium, fontSize: 14, lineHeight: 22, color: palette.ink }, inputRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderWidth: 1, borderColor: palette.border, borderRadius: 16, backgroundColor: palette.white }, inputFocused: { borderColor: palette.pine, backgroundColor: palette.canvas }, input: { flex: 1, minWidth: 0, minHeight: 56, paddingHorizontal: 16, paddingVertical: 16, fontFamily: typography.sans, fontSize: 16, lineHeight: 24, color: palette.ink },
  show: { minWidth: 56, minHeight: 48, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' }, showLabel: { fontFamily: typography.medium, fontSize: 13, lineHeight: 20, color: palette.pine },
  link: { minHeight: 44, maxWidth: '100%', justifyContent: 'center', paddingVertical: 8 }, linkText: { fontFamily: typography.medium, fontSize: 14, lineHeight: 22, color: palette.pine }, rightLink: { alignItems: 'flex-end', marginTop: -12 }, switchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
  notice: { padding: 16, borderRadius: 16, backgroundColor: palette.canvasDeep, gap: 8 }, success: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: palette.sage }, noticeText: { flexShrink: 1, fontFamily: typography.sans, fontSize: 15, lineHeight: 23, color: palette.pine }, inboxIcon: { width: 64, height: 64, borderRadius: 24, backgroundColor: palette.sage, alignItems: 'center', justifyContent: 'center' },
  privacy: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingTop: 8 }, flex: { flex: 1, minWidth: 0 }, footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }, line: { flex: 1, height: 1, backgroundColor: palette.border }, footerText: { flexShrink: 1, fontFamily: typography.medium, fontSize: 9, lineHeight: 15, letterSpacing: 1.2, color: palette.muted }, loading: { padding: 24, alignItems: 'center', gap: 16 },
});
