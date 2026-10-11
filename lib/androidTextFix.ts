import { Platform, Text, TextInput } from 'react-native'

// OEM font measurement bug: on OPPO/OnePlus/Realme (ColorOS) the system font
// is measured narrower than it is drawn, so the last glyph/word of a one-line
// Text wraps and is clipped. Forcing an explicit family makes measure == draw.
// Wrapping `render` (not defaultProps.style) survives NativeWind turning
// className into a style prop. maxFontSizeMultiplier 1.3 keeps big system
// font sizes readable but stops them blowing layouts apart.
const MAX_FONT_SCALE = 1.3
const fix = { fontFamily: 'Roboto' }

function patch(Comp: any) {
  if (!Comp || typeof Comp.render !== 'function' || Comp.__androidFixed) return
  const original = Comp.render
  Comp.render = (props: any, ref: any) =>
    original(
      {
        ...props,
        maxFontSizeMultiplier: props.maxFontSizeMultiplier ?? MAX_FONT_SCALE,
        // 'highQuality' (Android default) re-breaks lines at draw time on some
        // OEM fonts, pushing the last word onto a clipped second line.
        textBreakStrategy: props.textBreakStrategy ?? 'simple',
        style: [fix, props.style], // explicit fontFamily in props.style wins
      },
      ref,
    )
  Comp.__androidFixed = true
}

if (Platform.OS === 'android') {
  patch(Text)
  patch(TextInput)
}
