import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, Platform, StyleSheet, TextInput, type TextInputInstance, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from './language-provider';
import { EntryRedirect } from './entry-redirect';
import { useCloud } from './cloud-provider';
import { LegacyAuthScreen, type AuthMode } from './legacy-auth-screen';
import { LaunchIssue, useWayloLaunch } from './waylo-launch';
import { WayloMark } from './waylo-mark';
import { MotionPressable } from './motion-pressable';
import { ActionButton, Icon, Screen, ui } from './travel-ui';
import { useDurableAction } from '@/hooks/use-durable-action';
import { palette, typography } from '@/constants/waylo';
import { authMessage, cleanEmail } from '@/lib/auth-policy';
import { cloudConfigured, requireCloud } from '@/lib/cloud-client';
import { authRedirectUrl, resendConfirmation } from '@/lib/auth-service';
import { passwordAccess } from '@/lib/password-access';
import { codeIssue, emailCodeIssue, resendSeconds, signedIn } from '@/lib/email-otp-policy';
import { withDeadline } from '@/lib/async-deadline';
import { useAppAccess, useLocalDemo } from './local-demo-provider';

// RN Web 0.21 still uses blurOnSubmit; native SDK 58 uses submitBehavior.
const nextField = Platform.OS === 'web' ? { blurOnSubmit: false } : { submitBehavior: 'submit' as const };

export function AuthScreen({ mode = 'login' }: { mode?: AuthMode }) {
  // Keep existing verified recovery links; primary login uses email and password.
  if (mode === 'forgot' || mode === 'reset') return <LegacyAuthScreen mode={mode} />;
  return <EmailAuth key={mode} mode={mode} />;
}
function EmailAuth({ mode }: { mode: 'login' | 'signup' | 'verify' }) {
  const cloud = useCloud(), launch = useWayloLaunch(), action = useDurableAction();
  const demo = useLocalDemo(), access = useAppAccess();
  const params = useLocalSearchParams<{ invite?: string }>();
  const { width, fontScale } = useWindowDimensions();
  const [email, setEmail] = useState(cloud.otpRequest?.email ?? cloud.pendingEmail);
  const [name, setName] = useState(cloud.otpRequest?.name ?? ''), [code, setCode] = useState('');
  const [password, setPassword] = useState(''), [showPassword, setShowPassword] = useState(false);
  const [confirmation, setConfirmation] = useState(''), [showConfirmation, setShowConfirmation] = useState(false);
  const emailInput = useRef<TextInputInstance>(null), passwordInput = useRef<TextInputInstance>(null), confirmationInput = useRef<TextInputInstance>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [retry, setRetry] = useState({ email: '', until: 0 });
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const invite = typeof params.invite === 'string' && /^[a-f0-9]{64}$/i.test(params.invite) ? params.invite : cloud.otpRequest?.invite;
  const target = invite ? { pathname: '/account' as const, params: { invite } } : '/home' as const;
  const pending = cloud.otpRequest;
  const verify = mode === 'verify';
  const verificationEmail = pending?.email ?? cleanEmail(email);
  const remaining = Math.max(pending && cleanEmail(email) === pending.email ? resendSeconds(pending.nextSendAt, clock) : 0, cleanEmail(email) === retry.email ? resendSeconds(retry.until, clock) : 0);
  useFocusEffect(useCallback(() => {
    if (mode !== 'verify') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!action.busy) router.replace({ pathname: pending?.mode === 'signup' ? '/sign-up' : '/login', params: invite ? { invite } : {} });
      return true;
    });
    return () => subscription.remove();
  }, [mode, pending?.mode, action.busy, invite]));
  if (!access.loading && access.canExplore) return <EntryRedirect href={target} />;
  if (!launch.onboardingReady) return launch.error ? <LaunchIssue /> : <Screen><ActivityIndicator accessibilityLabel="Reading your welcome preferences" color={palette.pine} /></Screen>;
  if (!launch.completed) return <EntryRedirect href="/" />;
  const move = (next: '/login' | '/sign-up' | '/verify-email') => { if (!action.busy) { Keyboard.dismiss(); router.replace({ pathname: next, params: invite ? { invite } : {} }); } };
  const requestCode = async () => {
    const issue = emailCodeIssue(verificationEmail);
    if (issue) { action.setError(issue); return; }
    if (pending && resendSeconds(pending.nextSendAt, Date.now())) return;
    if (retry.email === verificationEmail && resendSeconds(retry.until, Date.now())) return;
    Keyboard.dismiss();
    await action.run(async () => {
      const { error } = await resendConfirmation(verificationEmail);
      if (!active.current) return;
      if (error) {
        if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error.code || '')) { const now = Date.now(); setClock(now); setRetry({ email: verificationEmail, until: now + 60000 }); }
        throw new Error(authMessage(error));
      }
      const now = Date.now();
      cloud.setOtpRequest({ name: '', mode: 'login', ...pending, email: verificationEmail, method: 'password', requestedAt: now, nextSendAt: now + 60000 });
      setClock(now); setCode('');
      action.setMessage('A new verification email was requested. Use its newest code.');
    });
  };
  const submitPassword = async () => {
    Keyboard.dismiss();
    await action.run(async () => {
      const result = await passwordAccess(requireCloud(), { signup: mode === 'signup', email, password, confirmation, name, redirectTo: authRedirectUrl() });
      if (!active.current) return;
      if (result === 'confirmation-needed') {
        setPassword(''); setConfirmation(''); cloud.setPendingEmail(cleanEmail(email));
        cloud.setOtpRequest({ email: cleanEmail(email), name: '', mode: 'login', method: 'password', requestedAt: 0, nextSendAt: 0, ...(invite ? { invite } : {}) });
        router.replace({ pathname: '/verify-email', params: invite ? { invite } : {} }); return;
      }
      setPassword(''); setConfirmation(''); cloud.setPendingEmail(cleanEmail(email));
      if (result === 'signed-in') { cloud.setOtpRequest(null); router.replace(target); return; }
      const now = Date.now();
      cloud.setOtpRequest({ email: cleanEmail(email), name: name.trim(), mode: 'signup', method: 'password', requestedAt: now, nextSendAt: now + 60000, ...(invite ? { invite } : {}) });
      router.replace({ pathname: '/verify-email', params: invite ? { invite } : {} });
    });
  };
  const verifyCode = async () => {
    const issue = emailCodeIssue(verificationEmail) || codeIssue(code); if (issue) { action.setError(issue); return; }
    Keyboard.dismiss();
    await action.run(async () => {
      const result = await withDeadline(requireCloud().auth.verifyOtp({ email: verificationEmail, token: code.trim(), type: 'email' }), 25000, 'Code verification took too long. Check your connection and try again.');
      if (!active.current) return;
      if (result.error) throw new Error(result.error.code === 'otp_expired' ? 'This code is incorrect, expired or already used. Check the newest email or request another code.' : authMessage(result.error));
      if (!result.data.session || !signedIn(result.data.session)) throw new Error('The code could not establish a verified sign-in. Request a new one.');
      setCode(''); cloud.setOtpRequest(null); router.replace(target);
    });
  };
  return <Screen scroll><View style={[s.root, width < 360 && { paddingHorizontal: 16 }]}>
    <View style={[s.brand, mode === 'signup' && s.compactBrand]}><View style={s.mark}><WayloMark size={32} color={palette.pine} /></View><Text localize={false} style={s.wordmark}>waylo</Text></View>
    <Animated.View entering={launch.reducedMotion ? undefined : FadeInDown.duration(240)} style={[s.content, mode === 'signup' && s.signupContent]}>
      <View style={s.heading}><Text style={s.eyebrow}>{verify ? 'ONE CODE. A WORLD AWAITS.' : 'YOUR NEXT CHAPTER'}</Text><Text accessibilityRole="header" style={[s.title, mode === 'signup' && s.signupTitle, (width < 360 || fontScale > 1.3) && { fontSize: 42, lineHeight: 48 }]}>{verify ? 'A little code.\nA fresh adventure.' : mode === 'signup' ? 'Every journey\nstarts with you.' : 'Good to have\nyou back.'}</Text><Text style={ui.body}>{verify ? pending?.requestedAt ? 'Enter the one-time code from your verification email.' : 'Finish verifying your registered email. Enter your newest code or request a new one.' : mode === 'signup' ? 'A few details, one email verification. Then the journey is yours.' : 'Sign in with your email and password. Your next chapter is waiting.'}</Text></View>
      {demo.available && !cloud.session && <View style={s.demoCard}><Text style={s.eyebrow}>EXPLORE WITH A DEMO ACCOUNT</Text><Text style={ui.body}>Try Waylo as Demo Traveler. No email or code needed. Demo plans save separately on this device; cloud and AI need a real account.</Text><ActionButton secondary busy={action.busy} disabled={demo.loading} onPress={() => void action.run(async () => { Keyboard.dismiss(); await demo.start(); router.replace('/home'); })}>Try local demo</ActionButton>{!!demo.error && <Text accessibilityRole="alert" style={ui.error}>{demo.error}</Text>}<Text style={ui.small}>Available in development builds only.</Text></View>}
      <View style={[s.form, mode === 'signup' && s.signupForm, width >= 560 && s.card]}>
        {!cloudConfigured && <Text accessibilityRole="alert" style={ui.error}>Account services are not configured in this build. Your saved device trips are kept.</Text>}
        {!!cloud.sessionError && <Text accessibilityRole="alert" style={ui.error}>{cloud.sessionError}</Text>}
        {!!cloud.sessionNotice && <Text style={ui.small}>{cloud.sessionNotice}</Text>}
        {cloud.loading ? <ActivityIndicator accessibilityLabel="Restoring your sign-in" color={palette.pine} /> : verify ? <>
          {pending ? <View style={s.destination}><Icon name="shield" /><View style={s.flex}><Text style={s.label}>Check your inbox</Text><Text localize={false} style={ui.body}>{pending.email}</Text></View></View> : <View style={s.field}><Text style={s.label}>Registered email address</Text><TextInput accessibilityLabel="Registered email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false} maxLength={254} editable={!action.busy} placeholder="you@example.com" placeholderTextColor={palette.muted} style={s.input} /></View>}
          <View style={s.field}><Text style={s.label}>Email verification code</Text><TextInput accessibilityLabel="Email verification code" accessibilityHint="Paste the complete numeric code from your newest email" value={code} onChangeText={(value) => { setCode(value.replace(/\D/g, '').slice(0, 10)); action.setError(''); }} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" autoCorrect={false} autoCapitalize="none" maxLength={32} placeholder="Enter your code" placeholderTextColor={palette.muted} editable={!action.busy} style={[s.input, s.code]} returnKeyType="go" onSubmitEditing={() => void verifyCode()} /></View>
          <ActionButton busy={action.busy} onPress={() => void verifyCode()}>Verify & continue</ActionButton>
          <ActionButton secondary disabled={action.busy || !cloudConfigured || remaining > 0} onPress={() => void requestCode()}>{remaining ? `Resend code in ${remaining}s` : pending?.requestedAt ? 'Resend code' : 'Send verification code'}</ActionButton>
          <MotionPressable accessibilityRole="button" disabled={action.busy} onPress={() => { cloud.setOtpRequest(null); cloud.setPendingEmail(''); move(pending?.mode === 'signup' ? '/sign-up' : '/login'); }} style={s.link}><Text style={s.linkText}>Use a different email</Text></MotionPressable>
          <Text style={ui.small}>Use the newest numeric code and check spam. A link-only email cannot be pasted here; email-code delivery needs to be enabled by Waylo. Future logins use your password.</Text>
        </> : <>
          <View style={s.tabs} accessibilityRole="tablist">{(['login', 'signup'] as const).map((tab) => <MotionPressable key={tab} accessibilityRole="tab" aria-selected={(mode === 'signup') === (tab === 'signup')} accessibilityState={{ selected: (mode === 'signup') === (tab === 'signup'), disabled: action.busy }} disabled={action.busy} onPress={() => move(tab === 'login' ? '/login' : '/sign-up')} style={[s.tab, (mode === 'signup') === (tab === 'signup') && s.activeTab]}><Text style={s.linkText}>{tab === 'login' ? 'Log in' : 'Register'}</Text></MotionPressable>)}</View>
          {mode === 'signup' && <View style={s.field}><Text style={s.label}>Name</Text><TextInput accessibilityLabel="Name" aria-required value={name} onChangeText={setName} maxLength={100} autoComplete="name" textContentType="name" autoCapitalize="words" placeholder="What should we call you?" placeholderTextColor={palette.muted} editable={!action.busy} style={s.input} returnKeyType="next" {...nextField} onSubmitEditing={() => emailInput.current?.focus()} /></View>}
          <View style={s.field}><Text style={s.label}>Email address</Text><TextInput ref={emailInput} accessibilityLabel="Email address" aria-required value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false} maxLength={254} placeholder="you@example.com" placeholderTextColor={palette.muted} editable={!action.busy} style={s.input} returnKeyType="next" {...nextField} onSubmitEditing={() => passwordInput.current?.focus()} /></View>
          <View style={s.field}><Text style={s.label}>Password</Text><View style={s.passwordRow}><TextInput ref={passwordInput} accessibilityLabel="Password" aria-required value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} textContentType={mode === 'signup' ? 'newPassword' : 'password'} autoCapitalize="none" autoCorrect={false} maxLength={512} editable={!action.busy} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} placeholderTextColor={palette.muted} style={[s.input, s.passwordInput, s.flex]} returnKeyType={mode === 'signup' ? 'next' : 'go'} {...(mode === 'signup' ? nextField : {})} onSubmitEditing={() => { if (mode === 'signup') confirmationInput.current?.focus(); else void submitPassword(); }} /><MotionPressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={action.busy} onPress={() => setShowPassword(!showPassword)} style={s.passwordToggle}><Icon name={showPassword ? 'eye-off' : 'eye'} size={22} /></MotionPressable></View></View>
          {mode === 'signup' && <View style={s.field}><Text style={s.label}>Confirm Password</Text><View style={s.passwordRow}><TextInput ref={confirmationInput} accessibilityLabel="Confirm Password" aria-required value={confirmation} onChangeText={setConfirmation} secureTextEntry={!showConfirmation} autoComplete="new-password" textContentType="newPassword" autoCapitalize="none" autoCorrect={false} maxLength={512} editable={!action.busy} placeholder="Enter your password again" placeholderTextColor={palette.muted} style={[s.input, s.passwordInput, s.flex]} returnKeyType="go" onSubmitEditing={() => void submitPassword()} /><MotionPressable accessibilityRole="button" accessibilityLabel={showConfirmation ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showConfirmation} disabled={action.busy} onPress={() => setShowConfirmation(!showConfirmation)} style={s.passwordToggle}><Icon name={showConfirmation ? 'eye-off' : 'eye'} size={22} /></MotionPressable></View></View>}
          {mode === 'login' && <MotionPressable accessibilityRole="button" disabled={action.busy} onPress={() => router.push('/forgot-password')} style={s.link}><Text style={s.linkText}>Forgot password?</Text></MotionPressable>}
          <ActionButton busy={action.busy} disabled={!cloudConfigured} onPress={() => void submitPassword()}>{mode === 'signup' ? 'Create account' : 'Log in'}</ActionButton>
          {mode === 'login' && <MotionPressable accessibilityRole="button" disabled={action.busy} onPress={() => move('/verify-email')} style={s.link}><Text style={s.linkText}>Finish email verification</Text></MotionPressable>}
          <Text style={ui.small}>{mode === 'signup' ? 'We’ll send a verification email. New accounts receive traveler access only.' : 'Once your email is verified, no code is needed to log in.'}</Text>
        </>}
        {!!action.error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{action.error}</Text>}{!!action.message && <Text accessibilityLiveRegion="polite" style={ui.body}>{action.message}</Text>}
      </View>
      <View style={s.privacy}><Icon name="shield" size={18} /><Text style={[ui.small, s.flex]}>Your trips stay on this device. You choose what to save to the cloud.</Text></View>
    </Animated.View>
  </View></Screen>;
}
const s = StyleSheet.create({
  demoCard: { padding: 24, borderRadius: 24, backgroundColor: palette.sage, gap: 16 },
  compactBrand: { paddingVertical: 16 }, signupContent: { gap: 24 }, signupTitle: { fontSize: 48, lineHeight: 52 }, signupForm: { gap: 16 },
  passwordInput: { borderWidth: 0, backgroundColor: 'transparent' }, passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 16, backgroundColor: palette.white, paddingRight: 4 }, passwordToggle: { minWidth: 48, minHeight: 56, justifyContent: 'center', alignItems: 'center' },
  root: { width: '100%', maxWidth: 528, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 32 }, brand: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 24 }, mark: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.sage }, wordmark: { fontFamily: typography.editorial, fontSize: 34, lineHeight: 40, color: palette.pine }, content: { gap: 32 }, heading: { gap: 16 }, eyebrow: { fontFamily: typography.medium, fontSize: 11, lineHeight: 16, letterSpacing: 1.5, color: palette.pine }, title: { fontFamily: typography.editorial, fontSize: 54, lineHeight: 56, color: palette.ink }, form: { gap: 24 }, card: { backgroundColor: palette.white, borderWidth: 1, borderColor: palette.border, borderRadius: 24, padding: 24 }, field: { gap: 8 }, label: { fontFamily: typography.medium, fontSize: 14, lineHeight: 22, color: palette.ink }, input: { borderWidth: 1, borderColor: palette.border, borderRadius: 16, minHeight: 56, padding: 16, fontFamily: typography.sans, fontSize: 16, lineHeight: 24, color: palette.ink, backgroundColor: palette.white }, code: { fontSize: 24, lineHeight: 32, minHeight: 64, letterSpacing: 3 }, tabs: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: palette.sage, gap: 8 }, tab: { flex: 1, minHeight: 48, padding: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, activeTab: { backgroundColor: palette.white }, link: { minHeight: 48, justifyContent: 'center', alignItems: 'center' }, linkText: { fontFamily: typography.medium, fontSize: 14, lineHeight: 22, color: palette.pine }, destination: { flexDirection: 'row', gap: 16, padding: 16, borderRadius: 16, backgroundColor: palette.sage }, flex: { flex: 1, minWidth: 0 }, privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
});
