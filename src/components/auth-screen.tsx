import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, StyleSheet, TextInput, type TextInputInstance, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from './language-provider';
import { EntryRedirect } from './entry-redirect';
import { useCloud } from './cloud-provider';
import { LegacyAuthScreen, type AuthMode } from './legacy-auth-screen';
import { useWayloLaunch } from './waylo-launch';
import { WayloMark } from './waylo-mark';
import { MotionPressable } from './motion-pressable';
import { ActionButton, Icon, Screen, TravelGate, ui } from './travel-ui';
import { useDurableAction } from '@/hooks/use-durable-action';
import { palette, typography } from '@/constants/waylo';
import { authMessage, cleanEmail } from '@/lib/auth-policy';
import { cloudConfigured, requireCloud } from '@/lib/cloud-client';
import { authRedirectUrl, resendConfirmation, sendEmailCode } from '@/lib/auth-service';
import { passwordAccess } from '@/lib/password-access';
import { codeIssue, emailCodeIssue, resendSeconds, signedIn } from '@/lib/email-otp-policy';

export function AuthScreen({ mode = 'login' }: { mode?: AuthMode }) {
  // Existing recovery links remain supported alongside password and email-code login.
  if (mode === 'forgot' || mode === 'reset') return <LegacyAuthScreen mode={mode} />;
  return <TravelGate><EmailAuth key={mode} mode={mode} /></TravelGate>;
}
function EmailAuth({ mode }: { mode: 'login' | 'signup' | 'verify' }) {
  const cloud = useCloud(), launch = useWayloLaunch(), action = useDurableAction();
  const params = useLocalSearchParams<{ invite?: string }>();
  const { width, fontScale } = useWindowDimensions();
  const [email, setEmail] = useState(cloud.otpRequest?.email ?? cloud.pendingEmail);
  const [name, setName] = useState(''), [code, setCode] = useState('');
  const [method, setMethod] = useState<'password' | 'code'>('password');
  const [password, setPassword] = useState(''), [showPassword, setShowPassword] = useState(false);
  const passwordInput = useRef<TextInputInstance>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [retry, setRetry] = useState({ email: '', until: 0 });
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const invite = typeof params.invite === 'string' && /^[a-f0-9]{64}$/i.test(params.invite) ? params.invite : cloud.otpRequest?.invite;
  const target = invite ? { pathname: '/account' as const, params: { invite } } : '/home' as const;
  const pending = cloud.otpRequest;
  const verify = mode === 'verify' && !!pending;
  const remaining = Math.max(pending && cleanEmail(email) === pending.email ? resendSeconds(pending.nextSendAt, clock) : 0, cleanEmail(email) === retry.email ? resendSeconds(retry.until, clock) : 0);
  useFocusEffect(useCallback(() => {
    if (mode !== 'verify') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!action.busy) router.replace({ pathname: pending?.mode === 'signup' ? '/sign-up' : '/login', params: invite ? { invite } : {} });
      return true;
    });
    return () => subscription.remove();
  }, [mode, pending?.mode, action.busy, invite]));
  if (!launch.completed) return <EntryRedirect href="/" />;
  if (!cloud.loading && signedIn(cloud.session)) return <EntryRedirect href={target} />;
  const move = (next: '/login' | '/sign-up' | '/verify-email') => { if (!action.busy) { Keyboard.dismiss(); router.replace({ pathname: next, params: invite ? { invite } : {} }); } };
  const requestCode = async () => {
    const requestMode = verify ? pending.mode : mode === 'signup' ? 'signup' : 'login';
    const requestName = verify ? pending.name : name;
    const issue = emailCodeIssue(email, requestMode === 'signup' ? requestName : '');
    if (issue) { action.setError(issue); return; }
    if (pending?.email === cleanEmail(email) && resendSeconds(pending.nextSendAt, Date.now())) return;
    if (retry.email === cleanEmail(email) && resendSeconds(retry.until, Date.now())) return;
    Keyboard.dismiss();
    await action.run(async () => {
      const { error } = verify && pending.method === 'password' && pending.mode === 'signup'
        ? await resendConfirmation(email) : await sendEmailCode(email, requestMode, requestName);
      if (!active.current) return;
      if (error) {
        if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error.code || '')) { const now = Date.now(); setClock(now); setRetry({ email: cleanEmail(email), until: now + 60000 }); }
        throw new Error(authMessage(error));
      }
      const now = Date.now();
      cloud.setPendingEmail(cleanEmail(email)); cloud.setOtpRequest({ email: cleanEmail(email), name: requestName.trim(), mode: requestMode, method: verify ? pending.method : 'code', requestedAt: now, nextSendAt: now + 60000, ...(invite ? { invite } : {}) });
      setClock(now); setCode('');
      if (!verify) router.replace({ pathname: '/verify-email', params: invite ? { invite } : {} });
      else action.setMessage('A new code was requested. Use the newest email.');
    });
  };
  const submitPassword = async () => {
    Keyboard.dismiss();
    await action.run(async () => {
      const result = await passwordAccess(requireCloud(), { signup: mode === 'signup', email, password, name, redirectTo: authRedirectUrl() });
      if (!active.current) return;
      if (result === 'confirmation-needed') {
        setMethod('code'); setPassword('');
        throw new Error('Your email still needs verification. Send an email code below, or open your latest confirmation email.');
      }
      setPassword(''); cloud.setPendingEmail(cleanEmail(email));
      if (result === 'signed-in') { cloud.setOtpRequest(null); router.replace(target); return; }
      const now = Date.now();
      cloud.setOtpRequest({ email: cleanEmail(email), name: name.trim(), mode: 'signup', method: 'password', requestedAt: now, nextSendAt: now + 60000, ...(invite ? { invite } : {}) });
      router.replace({ pathname: '/verify-email', params: invite ? { invite } : {} });
    });
  };
  const verifyCode = async () => {
    const issue = codeIssue(code); if (issue) { action.setError(issue); return; }
    if (!pending) { move('/login'); return; }
    Keyboard.dismiss();
    await action.run(async () => {
      const result = await requireCloud().auth.verifyOtp({ email: pending.email, token: code.trim(), type: 'email' });
      if (!active.current) return;
      if (result.error) throw new Error(result.error.code === 'otp_expired' ? 'This code is incorrect, expired or already used. Check the newest email or request another code.' : authMessage(result.error));
      if (!result.data.session || !signedIn(result.data.session)) throw new Error('The code could not establish a verified sign-in. Request a new one.');
      setCode(''); cloud.setOtpRequest(null); router.replace(target);
    });
  };
  return <Screen scroll><View style={[s.root, width < 360 && { paddingHorizontal: 16 }]}>
    <View style={s.brand}><View style={s.mark}><WayloMark size={32} color={palette.pine} /></View><Text localize={false} style={s.wordmark}>waylo</Text></View>
    <Animated.View entering={launch.reducedMotion ? undefined : FadeInDown.duration(240)} style={s.content}>
      <View style={s.heading}><Text style={s.eyebrow}>{verify ? 'ONE CODE. A WORLD AWAITS.' : 'YOUR NEXT CHAPTER'}</Text><Text accessibilityRole="header" style={[s.title, (width < 360 || fontScale > 1.3) && { fontSize: 42, lineHeight: 48 }]}>{verify ? 'A little code.\nA fresh adventure.' : mode === 'signup' ? 'Every journey\nstarts with you.' : 'Good to have\nyou back.'}</Text><Text style={ui.body}>{verify ? 'Enter the one-time code from your email to continue.' : method === 'code' ? 'We’ll email a secure sign-in code. No password needed.' : mode === 'signup' ? 'Create your account, verify your email, then make it a journey.' : 'Sign in with your email and password. Your next chapter is waiting.'}</Text></View>
      <View style={[s.form, width >= 560 && s.card]}>
        {!cloudConfigured && <Text accessibilityRole="alert" style={ui.error}>Account services are not configured in this build. Your saved device trips are kept.</Text>}
        {!!cloud.sessionError && <Text accessibilityRole="alert" style={ui.error}>{cloud.sessionError}</Text>}
        {!!cloud.sessionNotice && <Text style={ui.small}>{cloud.sessionNotice}</Text>}
        {cloud.loading ? <ActivityIndicator accessibilityLabel="Restoring your sign-in" color={palette.pine} /> : verify ? <>
          <View style={s.destination}><Icon name="shield" /><View style={s.flex}><Text style={s.label}>Check your inbox</Text><Text localize={false} style={ui.body}>{pending.email}</Text></View></View>
          <View style={s.field}><Text style={s.label}>Email verification code</Text><TextInput accessibilityLabel="Email verification code" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" autoCorrect={false} autoCapitalize="none" maxLength={10} placeholder="Your email code" placeholderTextColor={palette.muted} editable={!action.busy} style={[s.input, s.code]} returnKeyType="go" onSubmitEditing={() => void verifyCode()} /></View>
          <ActionButton busy={action.busy} onPress={() => void verifyCode()}>Verify & continue</ActionButton>
          <ActionButton secondary busy={action.busy} disabled={remaining > 0} onPress={() => void requestCode()}>{remaining ? `Resend code in ${remaining}s` : 'Resend code'}</ActionButton>
          <MotionPressable accessibilityRole="button" disabled={action.busy} onPress={() => move(pending.mode === 'signup' ? '/sign-up' : '/login')} style={s.link}><Text style={s.linkText}>Use a different email</Text></MotionPressable>
          <Text style={ui.small}>Use the newest code and check spam if needed. If your email includes a secure sign-in link, you can open it on this device instead.</Text>
        </> : <>
          <View style={s.tabs} accessibilityRole="tablist">{(['login', 'signup'] as const).map((tab) => <MotionPressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: (mode === 'signup') === (tab === 'signup'), disabled: action.busy }} disabled={action.busy} onPress={() => move(tab === 'login' ? '/login' : '/sign-up')} style={[s.tab, (mode === 'signup') === (tab === 'signup') && s.activeTab]}><Text style={s.linkText}>{tab === 'login' ? 'Log in' : 'Register'}</Text></MotionPressable>)}</View>
          {mode === 'signup' && <View style={s.field}><Text style={s.label}>Name (optional)</Text><TextInput accessibilityLabel="Name (optional)" value={name} onChangeText={setName} maxLength={100} autoComplete="name" textContentType="name" autoCapitalize="words" placeholder="What should we call you?" placeholderTextColor={palette.muted} editable={!action.busy} style={s.input} /></View>}
          <View style={s.field}><Text style={s.label}>Email address</Text><TextInput accessibilityLabel="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false} maxLength={254} placeholder="you@example.com" placeholderTextColor={palette.muted} editable={!action.busy} style={s.input} returnKeyType={method === 'password' ? 'next' : 'go'} onSubmitEditing={() => { if (method === 'code') void requestCode(); else passwordInput.current?.focus(); }} /></View>
          {method === 'password' && <View style={s.field}><Text style={s.label}>Password</Text><View style={s.passwordRow}><TextInput ref={passwordInput} accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} textContentType={mode === 'signup' ? 'newPassword' : 'password'} autoCapitalize="none" autoCorrect={false} maxLength={512} editable={!action.busy} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} placeholderTextColor={palette.muted} style={[s.input, s.flex]} returnKeyType="go" onSubmitEditing={() => void submitPassword()} /><MotionPressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} disabled={action.busy} onPress={() => setShowPassword(!showPassword)} style={s.passwordToggle}><Text style={s.linkText}>{showPassword ? 'Hide' : 'Show'}</Text></MotionPressable></View>{mode === 'login' && <MotionPressable accessibilityRole="button" disabled={action.busy} onPress={() => router.push('/forgot-password')} style={s.link}><Text style={s.linkText}>Forgot password?</Text></MotionPressable>}</View>}
          <ActionButton busy={action.busy} disabled={!cloudConfigured || method === 'code' && remaining > 0} onPress={() => void (method === 'password' ? submitPassword() : requestCode())}>{method === 'password' ? mode === 'signup' ? 'Create account' : 'Log in' : remaining ? `Request another code in ${remaining}s` : 'Send email code'}</ActionButton>
          <MotionPressable accessibilityRole="button" disabled={action.busy} onPress={() => { setMethod(method === 'password' ? 'code' : 'password'); setPassword(''); action.setError(''); action.setMessage(''); }} style={s.link}><Text style={s.linkText}>{method === 'password' ? 'Use an email code instead' : 'Use a password instead'}</Text></MotionPressable>
          <Text style={ui.small}>{mode === 'signup' ? 'Email verification is required. New accounts receive traveler access only.' : method === 'password' ? 'Already verified? Password login takes you straight to your plans.' : 'Use email code if you created an account without a password.'}</Text>
        </>}
        {!!action.error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{action.error}</Text>}{!!action.message && <Text accessibilityLiveRegion="polite" style={ui.body}>{action.message}</Text>}
      </View>
      <View style={s.privacy}><Icon name="shield" size={18} /><Text style={[ui.small, s.flex]}>Your trips stay on this device. You choose what to save to the cloud.</Text></View>
    </Animated.View>
  </View></Screen>;
}
const s = StyleSheet.create({
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, passwordToggle: { minWidth: 48, minHeight: 56, justifyContent: 'center', alignItems: 'center' },
  root: { width: '100%', maxWidth: 528, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 32 }, brand: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 24 }, mark: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.sage }, wordmark: { fontFamily: typography.editorial, fontSize: 34, lineHeight: 40, color: palette.pine }, content: { gap: 32 }, heading: { gap: 16 }, eyebrow: { fontFamily: typography.medium, fontSize: 11, lineHeight: 16, letterSpacing: 1.5, color: palette.pine }, title: { fontFamily: typography.editorial, fontSize: 54, lineHeight: 56, color: palette.ink }, form: { gap: 24 }, card: { backgroundColor: palette.white, borderWidth: 1, borderColor: palette.border, borderRadius: 24, padding: 24 }, field: { gap: 8 }, label: { fontFamily: typography.medium, fontSize: 14, lineHeight: 22, color: palette.ink }, input: { borderWidth: 1, borderColor: palette.border, borderRadius: 16, minHeight: 56, padding: 16, fontFamily: typography.sans, fontSize: 16, lineHeight: 24, color: palette.ink, backgroundColor: palette.white }, code: { fontSize: 24, lineHeight: 32, minHeight: 64 }, tabs: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: palette.sage, gap: 8 }, tab: { flex: 1, minHeight: 48, padding: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, activeTab: { backgroundColor: palette.white }, link: { minHeight: 48, justifyContent: 'center', alignItems: 'center' }, linkText: { fontFamily: typography.medium, fontSize: 14, lineHeight: 22, color: palette.pine }, destination: { flexDirection: 'row', gap: 16, padding: 16, borderRadius: 16, backgroundColor: palette.sage }, flex: { flex: 1, minWidth: 0 }, privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
});
