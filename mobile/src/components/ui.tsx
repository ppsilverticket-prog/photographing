import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  type TextProps,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { fonts, radius, space, usePalette } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// ── 글자 ─────────────────────────────────────────────

const textVariants = {
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30 },
  heading: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 25 },
  subheading: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 23 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  mono: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 17 },
} satisfies Record<string, TextStyle>;

type Tone = 'ink' | 'muted' | 'faint' | 'accent' | 'warn' | 'danger' | 'onAccent';

export function Txt({
  variant = 'body',
  tone = 'ink',
  style,
  ...rest
}: TextProps & { variant?: keyof typeof textVariants; tone?: Tone }) {
  const c = usePalette();
  const color: Record<Tone, string> = {
    ink: c.ink,
    muted: c.muted,
    faint: c.faint,
    accent: c.accentInk,
    warn: c.warn,
    danger: c.danger,
    onAccent: c.onAccent,
  };
  return <Text {...rest} style={[textVariants[variant], { color: color[tone] }, style]} />;
}

// ── 버튼 ─────────────────────────────────────────────

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const c = usePalette();
  const look = {
    primary: { bg: c.accent, fg: c.onAccent, border: c.accent },
    secondary: { bg: c.bg, fg: c.ink, border: c.line },
    ghost: { bg: 'transparent', fg: c.accentInk, border: 'transparent' },
    danger: { bg: c.dangerSoft, fg: c.danger, border: c.dangerSoft },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive }}
      accessibilityHint={accessibilityHint}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: look.bg, borderColor: look.border, opacity: inactive ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={look.fg} /> : null}
          <Text style={[textVariants.bodyStrong, { color: look.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// ── 칩과 태그 ────────────────────────────────────────

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.accentSoft : c.bg,
          borderColor: selected ? c.accent : c.line,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[textVariants.smallStrong, { color: selected ? c.accentInk : c.muted }]}>{label}</Text>
    </Pressable>
  );
}

export function Tag({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'warn' | 'neutral' | 'danger' }) {
  const c = usePalette();
  const look = {
    accent: { bg: c.accentSoft, fg: c.accentInk },
    warn: { bg: c.warnSoft, fg: c.warn },
    neutral: { bg: c.surface, fg: c.muted },
    danger: { bg: c.dangerSoft, fg: c.danger },
  }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: look.bg }]}>
      <Text style={[textVariants.caption, { color: look.fg, fontFamily: fonts.semibold }]}>{label}</Text>
    </View>
  );
}

// ── 레이아웃 ─────────────────────────────────────────

export function Screen({
  children,
  contentStyle,
  footer,
}: {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
}) {
  const c = usePalette();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={[styles.screen, contentStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { borderTopColor: c.line, backgroundColor: c.bg }]}>{footer}</View> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = usePalette();
  return <View style={[styles.card, { borderColor: c.line, backgroundColor: c.bg }, style]}>{children}</View>;
}

export function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.sectionHead}>
        <Txt variant="heading">{title}</Txt>
        {action && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
            <Txt variant="smallStrong" tone="accent">
              {action}
            </Txt>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}>{children}</View>;
}

export function Wrap({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{children}</View>;
}

export function Divider() {
  const c = usePalette();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />;
}

// ── 알림 상자 ────────────────────────────────────────

export function Banner({
  tone = 'info',
  icon,
  children,
}: {
  tone?: 'info' | 'warn' | 'danger';
  icon?: IconName;
  children: ReactNode;
}) {
  const c = usePalette();
  const look = {
    info: { bg: c.accentSoft, fg: c.accentInk },
    warn: { bg: c.warnSoft, fg: c.warn },
    danger: { bg: c.dangerSoft, fg: c.danger },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: look.bg }]}>
      {icon ? <Ionicons name={icon} size={18} color={look.fg} style={{ marginTop: 2 }} /> : null}
      <Text style={[textVariants.small, { color: look.fg, flex: 1 }]}>{children}</Text>
    </View>
  );
}

// ── 입력 ─────────────────────────────────────────────

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Row>
        <Txt variant="smallStrong">{label}</Txt>
        {hint ? (
          <Txt variant="caption" tone="faint">
            {hint}
          </Txt>
        ) : null}
      </Row>
      {children}
      {error ? (
        <Txt variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

export function Input(props: TextInputProps & { invalid?: boolean }) {
  const c = usePalette();
  const { invalid, style, multiline, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={c.faint}
      multiline={multiline}
      {...rest}
      style={[
        textVariants.body,
        styles.input,
        {
          color: c.ink,
          borderColor: invalid ? c.danger : c.line,
          backgroundColor: c.bg,
          minHeight: multiline ? 110 : 48,
          textAlignVertical: multiline ? 'top' : 'center',
        },
        style,
      ]}
    />
  );
}

export function Stepper({
  value,
  label,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  label: string;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  const c = usePalette();
  const btn = (icon: IconName, next: number, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={next < min || next > max}
      onPress={() => onChange(next)}
      style={({ pressed }) => [
        styles.stepBtn,
        { borderColor: c.line, opacity: next < min || next > max ? 0.35 : pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={c.ink} />
    </Pressable>
  );
  return (
    <Row style={{ gap: space.md }}>
      {btn('remove', value - step, '줄이기')}
      <Txt variant="subheading" style={{ minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
        {label}
      </Txt>
      {btn('add', value + step, '늘리기')}
    </Row>
  );
}

export function Toggle({ value, onChange, label, hint }: { value: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyStrong">{label}</Txt>
        {hint ? (
          <Txt variant="caption" tone="muted">
            {hint}
          </Txt>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: value ? c.accent : c.line }]}>
        <View style={[styles.thumb, { backgroundColor: c.bg, alignSelf: value ? 'flex-end' : 'flex-start' }]} />
      </View>
    </Pressable>
  );
}

export function Checkbox({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}
    >
      <View
        style={[
          styles.checkbox,
          { borderColor: value ? c.accent : c.line, backgroundColor: value ? c.accent : c.bg },
        ]}
      >
        {value ? <Ionicons name="checkmark" size={14} color={c.onAccent} /> : null}
      </View>
      <Txt variant="small" style={{ flex: 1 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

// ── 사람과 사진 ──────────────────────────────────────

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const c = usePalette();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.4, color: c.accentInk }}>{name.slice(0, 1)}</Text>
    </View>
  );
}

export function PhotoPlaceholder({ height = 180, label }: { height?: number; label?: string }) {
  const c = usePalette();
  return (
    <View
      style={{
        height,
        borderRadius: radius.md,
        backgroundColor: c.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Ionicons name="image-outline" size={28} color={c.faint} />
      {label ? (
        <Txt variant="caption" tone="faint">
          {label}
        </Txt>
      ) : null}
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const c = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10} style={{ padding: 6 }}>
      <Ionicons name={icon} size={22} color={c.ink} />
    </Pressable>
  );
}

/** 되돌릴 수 없는 동작 전에 화면 안에서 한 번 더 묻는다. 웹에서는 Alert가 동작하지 않아 직접 만든다 */
export function InlineConfirm({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = 'warn',
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'warn' | 'danger';
}) {
  const c = usePalette();
  return (
    <View style={[styles.confirm, { backgroundColor: tone === 'danger' ? c.dangerSoft : c.warnSoft }]}>
      <Txt variant="small" tone={tone === 'danger' ? 'danger' : 'warn'}>
        {message}
      </Txt>
      <Row style={{ justifyContent: 'flex-end' }}>
        <Button label="돌아가기" variant="secondary" onPress={onCancel} style={{ minHeight: 40 }} />
        <Button label={confirmLabel} variant="danger" onPress={onConfirm} style={{ minHeight: 40 }} />
      </Row>
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  const c = usePalette();
  return (
    <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxl }}>
      <Ionicons name={icon} size={32} color={c.faint} />
      <Txt variant="bodyStrong">{title}</Txt>
      {body ? (
        <Txt variant="small" tone="muted" style={{ textAlign: 'center' }}>
          {body}
        </Txt>
      ) : null}
    </View>
  );
}

export function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Txt variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Txt>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  screen: {
    padding: space.xl,
    gap: space.xxl,
    paddingBottom: 48,
  },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 3,
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  confirm: {
    padding: space.md,
    borderRadius: radius.md,
    gap: space.md,
  },
});
