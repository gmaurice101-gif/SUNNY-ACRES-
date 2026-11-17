with open('/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace headers / labels
content = content.replace('Total ($)', 'Total (Ksh)')
content = content.replace('Amount ($)', 'Amount (Ksh)')
content = content.replace('Milk Revenue ($)', 'Milk Revenue (Ksh)')
content = content.replace('Egg Revenue ($)', 'Egg Revenue (Ksh)')
content = content.replace('Total Revenue ($)', 'Total Revenue (Ksh)')
content = content.replace('Amount Owed ($)', 'Amount Owed (Ksh)')
content = content.replace('Price per Liter ($)', 'Price per Liter (Ksh)')
content = content.replace('Price per Unit ($)', 'Price per Unit (Ksh)')

# Replace template literals showing dollar amounts with Ksh
import re
content = re.sub(r'\$\{', 'Ksh ${', content)

# Fix any double Ksh if already prefixed or similar edge cases
content = content.replace('Ksh Ksh ', 'Ksh ')

with open('/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replacement complete.")
