import re

with open('src/components/VendorDashboard.tsx', 'r') as f:
    content = f.read()

# Locate section where controls for Gold Menu Showcase start
start_controls_str = "{/* Controls for Gold Menu Showcase */}"
end_controls_str = "{/* Controls for Single Table Stand */}"

# Let's inspect where these are
pos1 = content.find(start_controls_str)
pos2 = content.find(end_controls_str)

print(f"Found positions: pos1={pos1}, pos2={pos2}")
