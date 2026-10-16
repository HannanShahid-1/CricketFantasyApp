import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { haptic } from './feedback'
import { Icon, type SFSymbol } from './Icon'
import { Txt } from './text'

// iOS "inset grouped" lists, like Settings: a small label, a rounded group of rows with hairline separators, and an
// optional footnote. Most screens are built from these.

/**
 * A group of rows. Separators are drawn between children, starting `inset` points from the left (line them up with
 * the row text: 16 for plain rows, ~62 for rows that start with an avatar).
 */
export function Section({ title, footer, action, inset = 16, children, style }: {
  title?: string; footer?: ReactNode; action?: ReactNode; inset?: number; children: ReactNode; style?: StyleProp<ViewStyle>
}) {
  const s = useStyles(styles)
  const rows = Children.toArray(children).filter(isValidElement)
  return (
    <View style={style}>
      {(title || action) && (
        <View style={s.header}>
          {title && <Txt up size={12} weight={600} tone="muted" style={{ flex: 1 }}>{title}</Txt>}
          {action}
        </View>
      )}
      <View style={s.group}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 && <View style={[s.sep, { marginLeft: inset }]} />}
            {row}
          </Fragment>
        ))}
      </View>
      {footer !== undefined && (typeof footer === 'string' ? <Txt size={12.5} tone="dim" style={s.footer}>{footer}</Txt> : <View style={s.footer}>{footer}</View>)}
    </View>
  )
}

/** A tappable list row: optional leading view, title + subtitle, trailing value, chevron when it navigates. */
export function Row({ title, subtitle, left, right, value, chevron, onPress, destructive, style, children }: {
  title?: ReactNode; subtitle?: ReactNode; left?: ReactNode; right?: ReactNode; value?: string; chevron?: boolean
  onPress?: () => void; destructive?: boolean; style?: StyleProp<ViewStyle>; children?: ReactNode
}) {
  const t = useTheme()
  const s = useStyles(styles)
  const body = (
    <>
      {left}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {typeof title === 'string' ? <Txt size={16} weight={500} tone={destructive ? 'loss' : 'text'} numberOfLines={1}>{title}</Txt> : title}
        {typeof subtitle === 'string' ? <Txt size={13} tone="muted" numberOfLines={2}>{subtitle}</Txt> : subtitle}
        {children}
      </View>
      {value !== undefined && <Txt size={15} tone="muted">{value}</Txt>}
      {right}
      {chevron && <Icon name="chevron.right" size={13} color={t.c.dim} weight="semibold" />}
    </>
  )
  if (!onPress) return <View style={[s.row, style]}>{body}</View>
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && s.pressed, style]}>
      {body}
    </Pressable>
  )
}

/** Row with a native switch (settings such as auto-sub). */
export function SwitchRow({ title, icon, value, onChange }: {
  title: string; icon?: SFSymbol; value: boolean; onChange: (v: boolean) => void
}) {
  const t = useTheme()
  return (
    <Row
      title={title}
      left={icon && <RowIcon name={icon} color={value ? t.c.accent : t.c.muted} />}
      right={
        <Switch
          value={value}
          onValueChange={(v) => {
            haptic.select()
            onChange(v)
          }}
          trackColor={{ true: t.c.accent }}
        />
      }
    />
  )
}

/** Rounded-square icon at the start of a row, like Settings. */
export function RowIcon({ name, color }: { name: SFSymbol; color: string }) {
  return (
    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: alpha(color, 0.16), alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={15} color={color} weight="semibold" />
    </View>
  )
}

/** Stat tiles in a wrapping grid, e.g. season points / matches / rank. */
export function Tiles({ items }: { items: { label: string; value: string; tone?: 'accent' | 'text' | 'gold' | 'loss' }[] }) {
  const s = useStyles(styles)
  return (
    <View style={s.tiles}>
      {items.map((it) => (
        <View key={it.label} style={s.tile}>
          <Txt num weight={700} size={21} tone={it.tone ?? 'text'} numberOfLines={1}>{it.value}</Txt>
          <Txt up size={10} weight={600} tone="dim" numberOfLines={1}>{it.label}</Txt>
        </View>
      ))}
    </View>
  )
}

/** Labelled numbers in one rounded panel, a grid with hairlines between cells (a player's batting line, say). */
export function StatGrid({ items, columns = 3 }: { items: { label: string; value: string }[]; columns?: number }) {
  const s = useStyles(styles)
  const rows = Array.from({ length: Math.ceil(items.length / columns) }, (_, r) => items.slice(r * columns, (r + 1) * columns))
  return (
    <View style={s.group}>
      {rows.map((row, r) => (
        <View key={r} style={[s.statRow, r > 0 && s.statRowSep]}>
          {Array.from({ length: columns }, (_, c) => (
            <View key={c} style={[s.stat, c > 0 && s.statSep]}>
              {row[c] && (
                <>
                  <Txt num weight={700} size={18} numberOfLines={1}>{row[c].value}</Txt>
                  <Txt size={12} tone="muted" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{row[c].label}</Txt>
                </>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

export function EmptyState({ icon, title, message, action }: { icon: SFSymbol; title: string; message?: string; action?: ReactNode }) {
  const t = useTheme()
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 24 }}>
      <Icon name={icon} size={34} color={t.c.dim} />
      <Txt display weight={700} size={18} style={{ textAlign: 'center' }}>{title}</Txt>
      {message && <Txt tone="muted" size={14} style={{ textAlign: 'center', lineHeight: 20 }}>{message}</Txt>}
      {action && <View style={{ marginTop: 8 }}>{action}</View>}
    </View>
  )
}

const styles = (t: Theme) => ({
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingHorizontal: 16, paddingBottom: 7 },
  group: { backgroundColor: t.c.panel, borderRadius: t.r.lg, overflow: 'hidden' as const },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: t.c.line2 },
  footer: { paddingHorizontal: 16, paddingTop: 7, lineHeight: 17 },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 50, paddingHorizontal: 16, paddingVertical: 10 },
  pressed: { backgroundColor: alpha(t.c.tint, 0.07) },
  tiles: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  // three to a row
  tile: { flexGrow: 1, flexBasis: '30%' as const, gap: 3, padding: 12, borderRadius: t.r.md, backgroundColor: t.c.panel },
  statRow: { flexDirection: 'row' as const },
  statRowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.line2 },
  stat: { flex: 1, minWidth: 0, gap: 2, paddingHorizontal: 14, paddingVertical: 11 },
  statSep: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: t.c.line2 },
})
