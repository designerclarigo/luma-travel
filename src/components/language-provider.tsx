import { createContext, type PropsWithChildren, useContext } from 'react';
import { Platform, Text as NativeText, type TextProps } from 'react-native';
import { type Language, translate } from '@/lib/translations';
import { useTravel } from './travel-provider';
const Context = createContext<Language>('en');
export function LanguageProvider({ children }: PropsWithChildren) { const { data } = useTravel(); return <Context.Provider value={data?.settings.language ?? 'en'}>{children}</Context.Provider>; }
export function useLanguage() { const language = useContext(Context); return { language, t: (value: string) => translate(value, language) }; }
/** Bundled copy lookup only; never changes stored input or provider data. */
export function Text({ children, style, localize = true, ...props }: TextProps & { localize?: boolean }) { const { language, t } = useLanguage(); const render = (value: React.ReactNode): React.ReactNode => typeof value === 'string' && localize ? t(value) : Array.isArray(value) ? value.map(render) : value; const content = render(children); return <NativeText {...props} accessibilityLabel={props.accessibilityLabel ? t(props.accessibilityLabel) : undefined} style={[style, language === 'hi' && localize && { fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif', letterSpacing: 0 }]}>{content}</NativeText>; }
