import re

with open('src/components/VendorDashboard.tsx', 'r') as f:
    content = f.read()

# 1. Check if color states exist or add them
target_state_anchor = "const [goldHighlights, setGoldHighlights] = useState(['Ladha Halisi', 'Huduma Bora', 'Bei Fair', 'Wateja wa Furahi ❤️']);"

new_color_states = """const [goldHighlights, setGoldHighlights] = useState(['Ladha Halisi', 'Huduma Bora', 'Bei Fair', 'Wateja wa Furahi ❤️']);
  const [goldThemePreset, setGoldThemePreset] = useState<string>('gold');
  const [goldPrimaryColor, setGoldPrimaryColor] = useState<string>('#eab308');
  const [goldAccentColor, setGoldAccentColor] = useState<string>('#f59e0b');
  const [goldBgColorStart, setGoldBgColorStart] = useState<string>('#23170a');
  const [goldBgColorEnd, setGoldBgColorEnd] = useState<string>('#050302');
  const [goldCardBgColor, setGoldCardBgColor] = useState<string>('#170e06');
  const [goldTextColor, setGoldTextColor] = useState<string>('#fef08a');
  const [showGoldDishes, setShowGoldDishes] = useState<boolean>(true);"""

if target_state_anchor in content and "const [goldThemePreset" not in content:
    content = content.replace(target_state_anchor, new_color_states)
    print("Added color states successfully!")

with open('src/components/VendorDashboard.tsx', 'w') as f:
    f.write(content)
