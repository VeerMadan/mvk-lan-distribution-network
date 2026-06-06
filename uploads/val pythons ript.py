import random

def generate_valorant_codes(amount=5):
    # Fixed prefix as requested
    prefix = "CC-VAL26"
    
    # Official Valorant Lore Pools
    agents = ["JETT", "SOVA", "OMEN", "RAZE", "REYNA", "VIPER", "CLOVE", "ISO", "GEKKO", "YORU", "CYPHER", "CHAMBER", "MIKS"]
    items = ["CARDS", "SPRAY", "BUDDY", "TITLE", "SKINS"]
    descriptors = ["HOLDN", "ALLUV", "ALPHA", "OMEGA", "RETRI", "PRIDE", "DUAL", "REAVER", "PRIME", "ION", "GLITCH"]
    maps = ["ASCENT", "BIND", "HAVEN", "SPLIT", "LOTUS", "PEARL", "SUNSET", "ABYSS"]
    
    generated_codes = set()
    
    while len(generated_codes) < amount:
        # Pick a style template randomly to mimic your examples
        template_type = random.choice([1, 2, 3])
        
        if template_type == 1:
            # Format like: CC-VAL26-HOLDN-SPACE (Descriptor + Map/Word)
            middle = random.choice(descriptors)
            end = random.choice(maps)
            code = f"{prefix}-{middle}-{end}"
            
        elif template_type == 2:
            # Format like: CC-VAL26-ALLUV_SPRAY (Descriptor + Item with separator variety)
            middle = random.choice(descriptors)
            end = random.choice(items)
            sep = random.choice(["-", "_"]) # Keeps your dash/underscore mix
            code = f"{prefix}-{middle}{sep}{end}"w
            
        else:
            # Format like: CC-VAL26-PLAYER-CARDS (Agent/Role + Item)
            middle = random.choice(agents)
            end = random.choice(items)
            code = f"{prefix}-{middle}-{end}"
            
        generated_codes.add(code)
        import random

def generate_valorant_codes(amount=5):
    # Fixed prefix as requested
    prefix = "CC-VAL26"
    
    # Official Valorant Lore Pools
    agents = ["JETT", "SOVA", "OMEN", "RAZE", "REYNA", "VIPER", "CLOVE", "ISO", "GEKKO", "YORU", "CYPHER", "CHAMBER", "MIKS"]
    items = ["CARDS", "SPRAY", "BUDDY", "TITLE", "SKINS"]
    descriptors = ["HOLDN", "ALLUV", "ALPHA", "OMEGA", "RETRI", "PRIDE", "DUAL", "REAVER", "PRIME", "ION", "GLITCH"]
    maps = ["ASCENT", "BIND", "HAVEN", "SPLIT", "LOTUS", "PEARL", "SUNSET", "ABYSS"]
    
    generated_codes = set()
    
    while len(generated_codes) < amount:
        # Pick a style template randomly to mimic your examples
        template_type = random.choice([1, 2, 3])
        
        if template_type == 1:
            # Format like: CC-VAL26-HOLDN-SPACE (Descriptor + Map/Word)
            middle = random.choice(descriptors)
            end = random.choice(maps)
            code = f"{prefix}-{middle}-{end}"
            
        elif template_type == 2:
            # Format like: CC-VAL26-ALLUV_SPRAY (Descriptor + Item with separator variety)
            middle = random.choice(descriptors)
            end = random.choice(items)
            sep = random.choice(["-", "_"]) # Keeps your dash/underscore mix
            code = f"{prefix}-{middle}{sep}{end}"
            
        else:
            # Format like: CC-VAL26-PLAYER-CARDS (Agent/Role + Item)
            middle = random.choice(agents)
            end = random.choice(items)
            code = f"{prefix}-{middle}-{end}"
            
        generated_codes.add(code)
        
    return list(generated_codes)

# --- CONFIGURATION ---
# Number of random Valorant codes you want to create
number_of_codes = 8 
# ---------------------

# Run the generator
valorant_codes = generate_valorant_codes(number_of_codes)

print(f"Generated {number_of_codes} Valorant-themed codes:")
for code in valorant_codes:
    print(code)
