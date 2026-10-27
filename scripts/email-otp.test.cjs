const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {load}=require('./test-support.cjs');
const policy=load('src/lib/email-otp-policy.ts');
test('email OTP entry routes first launches, signed-out users and confirmed returning sessions correctly',()=>{
 assert.equal(policy.entryDestination(false,null),'/');
 assert.equal(policy.entryDestination(true,null),'/login');
 assert.equal(policy.entryDestination(true,{user:{email_confirmed_at:null}}),'/login');
 assert.equal(policy.entryDestination(true,{user:{email_confirmed_at:'2026-10-27'}}),'/home');
});
test('email OTP minimal fields accept an optional name but reject malformed addresses and codes',()=>{
 assert.equal(policy.emailCodeIssue('name@example.com'),'');
 assert.equal(policy.emailCodeIssue(' NAME@example.com ','Ari Santos'),'');
 assert.match(policy.emailCodeIssue('not-email'),/email/);
 assert.match(policy.emailCodeIssue('name@example.com','A\nB'),/name/);
 assert.match(policy.emailCodeIssue('name@example.com','A'),/name/);
 for(const code of ['123456','12345678','1234567890']) assert.equal(policy.codeIssue(code),'');
 for(const code of ['12345','12a456','12345678901']) assert.match(policy.codeIssue(code),/code/);
});
test('OTP resend deadlines recover accurately from background time and do not become negative',()=>{
 assert.equal(policy.resendSeconds(61000,1000),60);assert.equal(policy.resendSeconds(61000,60500),1);
 assert.equal(policy.resendSeconds(61000,61000),0);assert.equal(policy.resendSeconds(61000,100000),0);
});
test('every travel route is protected while the existing account invitation bridge requires confirmation',()=>{
 const routes=load('src/lib/auth-routes.ts').protectedRouteNames;
 const publicRoutes=new Set(['index','ready','onboarding','login','sign-up','verify-email','forgot-password','reset-password','account']);
 const travelFiles=fs.readdirSync('src/app').filter(name=>name.endsWith('.tsx')&&!name.startsWith('_')&&!name.startsWith('+')).map(name=>name.slice(0,-4)).filter(name=>!publicRoutes.has(name));
 assert.deepEqual([...routes].filter(name=>name!=='(main)').sort(),travelFiles.sort());assert.ok(routes.includes('(main)'));
 assert.match(fs.readFileSync('src/components/account-screen.tsx','utf8'),/if \(!session\?\.user.email_confirmed_at\)/);
});
test('OTP flow uses real Supabase OTP calls, only registration may create users, and templates contain actual provider tokens',()=>{
 const service=fs.readFileSync('src/lib/auth-service.ts','utf8');
 assert.match(service,/auth\.signInWithOtp/);assert.match(service,/shouldCreateUser: mode === 'signup'/);
 const screen=fs.readFileSync('src/components/auth-screen.tsx','utf8');
 assert.match(screen,/auth\.verifyOtp\(\{ email: pending.email, token: code.trim\(\), type: 'email'/);
 assert.match(screen,/passwordAccess\(requireCloud\(\)/);assert.match(screen,/result === 'signed-in'/);
 assert.match(screen,/result === 'confirmation-needed'/);assert.match(screen,/await resendConfirmation\(email\)/);
 for(const name of ['signup-otp','login-otp']) assert.match(fs.readFileSync(`backend/email-templates/${name}.html`,'utf8'),/\{\{ \.Token \}\}/);
});
