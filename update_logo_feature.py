import re

with open('src/components/VendorDashboard.tsx', 'r') as f:
    content = f.read()

# 1. Check if goldLogoUrl state exists
if 'const [goldLogoUrl,' not in content:
    content = content.replace(
        "const [showGoldDishes, setShowGoldDishes] = useState<boolean>(true);",
        """const [showGoldDishes, setShowGoldDishes] = useState<boolean>(true);
  const [goldLogoUrl, setGoldLogoUrl] = useState<string>('');
  const [isGoldLogoUploading, setIsGoldLogoUploading] = useState<boolean>(false);
  const [showGoldLogo, setShowGoldLogo] = useState<boolean>(true);"""
    )
    print("Added goldLogoUrl state!")

with open('src/components/VendorDashboard.tsx', 'w') as f:
    f.write(content)
