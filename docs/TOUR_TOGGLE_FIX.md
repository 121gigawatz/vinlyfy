# Guided Tour Toggle Highlighting Fix

## Problem

The guided tour was only highlighting the checkbox input element of toggle switches, not the entire visual toggle component. This made it difficult for users to see what was being highlighted during the tour.

## Solution

Added `onHighlightStarted` callbacks to all toggle switch tour steps that:
1. Find the parent `.toggle` label element using `closest('.toggle')`
2. Replace the highlighted element with the parent label
3. This ensures the entire toggle switch (including the visual switch and label text) is highlighted

## Changes Made

### [app.js](file:///Users/bwatz/projects/vinylfy/needle/js/app.js)

Updated 7 toggle switch tour steps:

1. **Frequency Response** (`#frequencyResponse`)
2. **Surface Noise** (`#surfaceNoiseToggle`) - also changed to use wrapper ID
3. **Harmonic Distortion** (`#harmonicDistortion`)
4. **Wow & Flutter** (`#wowFlutter`)
5. **Stereo Reduction** (`#stereoReduction`)
6. **High-Pass Filter** (`#hpfEnabled`)
7. **Low-Pass Filter** (`#lpfEnabled`)

### Code Pattern

```javascript
{
  element: '#toggleInputId',
  onHighlightStarted: (element) => {
    const label = element.element.closest('.toggle');
    if (label) element.element = label;
  },
  popover: {
    title: 'Toggle Title',
    description: 'Toggle description',
    side: 'top',
    align: 'center'
  }
}
```

## Result

✅ **Entire toggle switches are now highlighted** during the guided tour
✅ **Better user experience** - users can clearly see which control is being explained
✅ **Consistent highlighting** across all toggle switches
✅ **No HTML changes required** - pure JavaScript solution

## Testing

To verify the fix:
1. Open Vinylfy in your browser
2. Click any help button (?) to start a guided tour
3. Navigate to toggle switch steps
4. Verify the entire toggle component (checkbox + visual switch + label) is highlighted
