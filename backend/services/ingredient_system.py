"""
DogeFood Lab — SEASON 2 Ingredient System
50 ingredients across 5 tiers: Starter / Rare / Epic / Legendary / Mythic
Backend crafting engine remains untouched; only the catalog data is replaced.
"""

from typing import Dict, List, Optional
from enum import Enum
from dataclasses import dataclass


class IngredientCategory(Enum):
    STARTER = "Starter"
    RARE = "Rare"
    EPIC = "Epic"
    LEGENDARY = "Legendary"
    MYTHIC = "Mythic"


class SpecialEffect(Enum):
    NONE = "None"
    XP_BOOST = "XP Boost"
    MINOR_XP_BOOST = "Minor XP Boost"
    RARITY_BOOST = "Rarity Boost"
    LEGENDARY_GATE = "Legendary Gate"
    TIMER_REDUCTION = "Timer Reduction"
    TIMER_INCREASE = "Timer Increase"
    VISUAL_EFFECT = "Visual Effect"
    VISUAL_GLOW = "Visual Glow"
    VISUAL_GLITCH = "Visual Glitch"
    POINTS_BOOST = "Points Boost"
    MYTHIC_GATE = "Mythic Gate"
    MUTATION_CHANCE = "Mutation Chance"
    RNG_BOOST = "RNG Boost"
    TIMER_RANDOMIZER = "Timer Randomizer"
    MYTHIC_REQUIRED = "Mythic Required"


@dataclass
class Ingredient:
    id: str
    name: str
    category: IngredientCategory
    rarity_weight: float
    description: str
    special_effect: SpecialEffect
    unlock_level: int
    emoji: str
    color: str


# Tier color palette (used by frontend for glow / borders)
_TIER_COLOR = {
    IngredientCategory.STARTER:   "#F59E0B",  # amber
    IngredientCategory.RARE:      "#3B82F6",  # blue
    IngredientCategory.EPIC:      "#A855F7",  # purple
    IngredientCategory.LEGENDARY: "#FBBF24",  # gold
    IngredientCategory.MYTHIC:    "#EC4899",  # magenta/pink
}


# ============================================================
# SEASON 2 CATALOG — 50 ingredients
# (id, name, level, emoji, special_effect, description)
# ============================================================
_S2_DATA = [
    # ---- STARTER (Level 1–10) ----
    ("S2_001", "Pupcorn Bits",            1,  "🍿",  SpecialEffect.NONE,             "Light, airy starter snack — the basic crunch."),
    ("S2_002", "Dogeberry Syrup",         2,  "🫐",  SpecialEffect.MINOR_XP_BOOST,   "Sweet meme-berry syrup with a faint XP shimmer."),
    ("S2_003", "Bark Biscuit Crumbs",     3,  "🍪",  SpecialEffect.NONE,             "Crumbled biscuit base used in countless recipes."),
    ("S2_004", "Meme Milk Capsules",      4,  "🥛",  SpecialEffect.MINOR_XP_BOOST,   "Frothy lab-grown milk in encapsulated form."),
    ("S2_005", "Cheddar Woof Chips",      5,  "🧀",  SpecialEffect.NONE,             "Crispy cheddar chips with a Shiba kick."),
    ("S2_006", "Rocket Ramen Strands",    6,  "🍜",  SpecialEffect.XP_BOOST,         "Hyper-speed noodle strands rich in flavor."),
    ("S2_007", "Frosted Paw Sugar",       7,  "❄️",  SpecialEffect.VISUAL_EFFECT,    "Icy sugar that sparkles on contact."),
    ("S2_008", "Moonbone Jelly",          8,  "🌙",  SpecialEffect.XP_BOOST,         "Lunar gelatin — soft, glowing, energizing."),
    ("S2_009", "Turbo Tail Spice",        9,  "🌶️", SpecialEffect.TIMER_REDUCTION,  "Fiery spice that speeds up the reactor."),
    ("S2_010", "Pupperoni Slices",        10, "🍕",  SpecialEffect.XP_BOOST,         "Premium pupperoni — a starter staple favorite."),

    # ---- RARE (Level 11–20) ----
    ("S2_011", "Galaxy Kibble",           11, "🌌",  SpecialEffect.RARITY_BOOST,     "Crunchy kibble with stardust baked in."),
    ("S2_012", "Neon Nuggies",            12, "🟦",  SpecialEffect.VISUAL_EFFECT,    "Cyber-bright nuggets that hum with energy."),
    ("S2_013", "Alpha Bacon Strips",      13, "🥓",  SpecialEffect.XP_BOOST,         "Top-grade bacon — pure protein power."),
    ("S2_014", "Lunar Marshmallows",      14, "☁️",  SpecialEffect.TIMER_REDUCTION,  "Fluffy moon-mallows that bend cook time."),
    ("S2_015", "Boneblast Seasoning",     15, "💥",  SpecialEffect.RARITY_BOOST,     "Explosive bone-dust spice blend."),
    ("S2_016", "Crypto Caramel Drizzle",  16, "🍯",  SpecialEffect.POINTS_BOOST,     "Golden caramel infused with on-chain magic."),
    ("S2_017", "Shiba Spice Cubes",       17, "🌶️", SpecialEffect.XP_BOOST,         "Fiery Shiba-grade seasoning cubes."),
    ("S2_018", "Plasma Peanut Butter",    18, "🥜",  SpecialEffect.RARITY_BOOST,     "Glowing PB charged with plasma energy."),
    ("S2_019", "Byte-sized Sausages",     19, "🌭",  SpecialEffect.VISUAL_GLITCH,    "Pixelated sausages from the meme-net."),
    ("S2_020", "Doge Dust Crunch",        20, "✨",  SpecialEffect.POINTS_BOOST,     "Sparkling crunch that boosts treat points."),

    # ---- EPIC (Level 21–30) ----
    ("S2_021", "Cyber Corn Nuggets",      21, "🌽",  SpecialEffect.RARITY_BOOST,     "Cybernetic corn — chrome on the outside, fire within."),
    ("S2_022", "Quantum Treat Flakes",    22, "🥣",  SpecialEffect.RNG_BOOST,        "Flakes existing in two states at once."),
    ("S2_023", "Mega Moo Protein Gel",    23, "🥤",  SpecialEffect.XP_BOOST,         "High-density protein gel for elite gains."),
    ("S2_024", "Astro Syrup Drops",       24, "💧",  SpecialEffect.VISUAL_GLOW,      "Galactic syrup that glows in the dark."),
    ("S2_025", "Hyper Bone Broth",        25, "🍲",  SpecialEffect.TIMER_REDUCTION,  "Concentrated bone broth — instant warmup."),
    ("S2_026", "Electric Biscuit Chunks", 26, "⚡",  SpecialEffect.LEGENDARY_GATE,   "Crackling biscuit shards — gateway to legendary."),
    ("S2_027", "Meme Pepper Sprinkles",   27, "🌶️", SpecialEffect.POINTS_BOOST,     "Spicy sprinkles that ignite combo points."),
    ("S2_028", "Infinity Ice Cream Bits", 28, "🍨",  SpecialEffect.RARITY_BOOST,     "Pastel ice fragments from a frozen galaxy."),
    ("S2_029", "Darkmatter Donut Crumbs", 29, "🍩",  SpecialEffect.LEGENDARY_GATE,   "Dense, gravity-warping donut crumbs."),
    ("S2_030", "Stellar Steak Cubes",     30, "🥩",  SpecialEffect.XP_BOOST,         "Glowing space-aged steak cubes."),

    # ---- LEGENDARY (Level 31–40) ----
    ("S2_031", "Golden Tail Granules",    31, "🌟",  SpecialEffect.POINTS_BOOST,     "Granules of pure pup-gold dust."),
    ("S2_032", "Nebula Nacho Dust",       32, "🌠",  SpecialEffect.VISUAL_GLOW,      "Brilliant nebula seasoning for elite treats."),
    ("S2_033", "Titanium Taffy Chunks",   33, "🔱",  SpecialEffect.LEGENDARY_GATE,   "Iridescent taffy — strong as titanium."),
    ("S2_034", "Omega Bacon Powder",      34, "🥓",  SpecialEffect.LEGENDARY_GATE,   "The final form of bacon: powderized power."),
    ("S2_035", "Celestial Cheese Melt",   35, "🧀",  SpecialEffect.RNG_BOOST,        "Heavenly molten cheese — luck included."),
    ("S2_036", "Frostfang Yogurt Drops",  36, "🧊",  SpecialEffect.TIMER_RANDOMIZER, "Icy yogurt drops that warp cook time."),
    ("S2_037", "Meteor Meat Flakes",      37, "☄️",  SpecialEffect.LEGENDARY_GATE,   "Charred meteor meat — burning with rarity."),
    ("S2_038", "Shiba Stardust Syrup",    38, "💫",  SpecialEffect.MYTHIC_GATE,      "Pure stardust syrup — opens the mythic door."),
    ("S2_039", "Royal Rocket Crunch",     39, "🚀",  SpecialEffect.MUTATION_CHANCE,  "Royal-grade rocket crunch — mutations likely."),
    ("S2_040", "Mythic Paw Crystals",     40, "🐾",  SpecialEffect.MYTHIC_GATE,      "Rainbow paw-crystals — true mythic catalyst."),

    # ---- MYTHIC (Level 41–50) ----
    ("S2_041", "Infinity Bone Essence",   41, "♾️",  SpecialEffect.MYTHIC_REQUIRED,  "Eternal essence distilled from primordial bone."),
    ("S2_042", "Galactic Gravy Cubes",    42, "🌀",  SpecialEffect.MYTHIC_REQUIRED,  "Compressed galactic gravy of legend."),
    ("S2_043", "Ultra Woof Extract",      43, "🧪",  SpecialEffect.MYTHIC_REQUIRED,  "Concentrated woof — the soul of every Shiba."),
    ("S2_044", "Eclipse Energy Flakes",   44, "🌑",  SpecialEffect.MYTHIC_REQUIRED,  "Flakes harvested during a cosmic eclipse."),
    ("S2_045", "Phoenix Pepper Oil",      45, "🔥",  SpecialEffect.MYTHIC_REQUIRED,  "Pepper oil that resurrects every dish."),
    ("S2_046", "Cosmic Kibble Core",      46, "🪐",  SpecialEffect.MYTHIC_REQUIRED,  "Planetary kibble core — gravity included."),
    ("S2_047", "Dragon Tail Protein",     47, "🐉",  SpecialEffect.MYTHIC_REQUIRED,  "Mythic dragon-tail meat — power tier."),
    ("S2_048", "Meme Core Crystals",      48, "💎",  SpecialEffect.MYTHIC_REQUIRED,  "Crystals storing the purest meme energy."),
    ("S2_049", "Supernova Snack Dust",    49, "🌟",  SpecialEffect.MYTHIC_REQUIRED,  "Explosive dust forged in a dying star."),
    ("S2_050", "Godtier Shiba Serum",     50, "👑",  SpecialEffect.MYTHIC_REQUIRED,  "The ultimate Shiba serum. Legends only."),
]


# Tier resolution by unlock_level
def _category_for_level(level: int) -> IngredientCategory:
    if level <= 10:
        return IngredientCategory.STARTER
    if level <= 20:
        return IngredientCategory.RARE
    if level <= 30:
        return IngredientCategory.EPIC
    if level <= 40:
        return IngredientCategory.LEGENDARY
    return IngredientCategory.MYTHIC


# Rarity weights scale smoothly within each tier
_TIER_WEIGHT_RANGE = {
    IngredientCategory.STARTER:   (1.00, 1.15),
    IngredientCategory.RARE:      (1.20, 1.40),
    IngredientCategory.EPIC:      (1.45, 1.75),
    IngredientCategory.LEGENDARY: (1.80, 2.25),
    IngredientCategory.MYTHIC:    (2.50, 3.50),
}


def _weight_for(level: int, category: IngredientCategory) -> float:
    lo, hi = _TIER_WEIGHT_RANGE[category]
    # 10 levels per tier; relative position 0..9
    tier_start = {
        IngredientCategory.STARTER: 1,
        IngredientCategory.RARE: 11,
        IngredientCategory.EPIC: 21,
        IngredientCategory.LEGENDARY: 31,
        IngredientCategory.MYTHIC: 41,
    }[category]
    pos = (level - tier_start) / 9.0  # 0..1
    return round(lo + (hi - lo) * pos, 2)


# Build the catalog
INGREDIENTS_CATALOG: Dict[str, Ingredient] = {}
for _id, _name, _level, _emoji, _effect, _desc in _S2_DATA:
    _cat = _category_for_level(_level)
    INGREDIENTS_CATALOG[_id] = Ingredient(
        id=_id,
        name=_name,
        category=_cat,
        rarity_weight=_weight_for(_level, _cat),
        description=_desc,
        special_effect=_effect,
        unlock_level=_level,
        emoji=_emoji,
        color=_TIER_COLOR[_cat],
    )


# Category styles consumed by the frontend
CATEGORY_STYLES = {
    IngredientCategory.STARTER: {
        "color": "#F59E0B",
        "bg_gradient": "from-amber-500/20 to-orange-500/20",
        "border": "border-amber-500/50",
        "glow": "shadow-amber-500/30",
        "name": "Starter",
        "unlock_range": "Level 1-10",
    },
    IngredientCategory.RARE: {
        "color": "#3B82F6",
        "bg_gradient": "from-blue-500/20 to-cyan-500/20",
        "border": "border-blue-500/50",
        "glow": "shadow-blue-500/30",
        "name": "Rare",
        "unlock_range": "Level 11-20",
    },
    IngredientCategory.EPIC: {
        "color": "#A855F7",
        "bg_gradient": "from-purple-500/20 to-indigo-500/20",
        "border": "border-purple-500/50",
        "glow": "shadow-purple-500/30",
        "name": "Epic",
        "unlock_range": "Level 21-30",
    },
    IngredientCategory.LEGENDARY: {
        "color": "#FBBF24",
        "bg_gradient": "from-yellow-500/20 via-amber-500/20 to-orange-500/20",
        "border": "border-yellow-400/60",
        "glow": "shadow-yellow-400/40",
        "name": "Legendary",
        "unlock_range": "Level 31-40",
    },
    IngredientCategory.MYTHIC: {
        "color": "#EC4899",
        "bg_gradient": "from-pink-500/20 via-fuchsia-500/20 to-purple-500/20",
        "border": "border-pink-400/70",
        "glow": "shadow-pink-400/50",
        "name": "Mythic",
        "unlock_range": "Level 41-50",
    },
}


class IngredientSystem:
    def __init__(self):
        self.ingredients = INGREDIENTS_CATALOG
        self.category_styles = CATEGORY_STYLES

    def get_ingredient(self, ingredient_id: str) -> Optional[Ingredient]:
        return self.ingredients.get(ingredient_id)

    def get_ingredients_by_category(self, category: IngredientCategory) -> List[Ingredient]:
        return [ing for ing in self.ingredients.values() if ing.category == category]

    def get_unlocked_ingredients(self, player_level: int) -> List[Ingredient]:
        return [ing for ing in self.ingredients.values() if ing.unlock_level <= player_level]

    def get_locked_ingredients(self, player_level: int) -> List[Ingredient]:
        return [ing for ing in self.ingredients.values() if ing.unlock_level > player_level]

    def get_ingredients_for_level_range(self, min_level: int, max_level: int) -> List[Ingredient]:
        return [
            ing for ing in self.ingredients.values()
            if min_level <= ing.unlock_level <= max_level
        ]

    def calculate_rarity_modifier(self, ingredients: List[str]) -> float:
        total_weight = 0.0
        for ing_id in ingredients:
            ing = self.get_ingredient(ing_id)
            if ing:
                total_weight += ing.rarity_weight
        return total_weight / len(ingredients) if ingredients else 1.0

    def get_special_effects(self, ingredients: List[str]) -> List[SpecialEffect]:
        effects = []
        for ing_id in ingredients:
            ing = self.get_ingredient(ing_id)
            if ing and ing.special_effect != SpecialEffect.NONE:
                effects.append(ing.special_effect)
        return effects

    def has_mythic_catalyst(self, ingredients: List[str]) -> bool:
        for ing_id in ingredients:
            ing = self.get_ingredient(ing_id)
            if ing and ing.special_effect == SpecialEffect.MYTHIC_REQUIRED:
                return True
        return False

    def has_legendary_gate(self, ingredients: List[str]) -> bool:
        for ing_id in ingredients:
            ing = self.get_ingredient(ing_id)
            if ing and ing.special_effect == SpecialEffect.LEGENDARY_GATE:
                return True
        return False

    def can_create_rarity(self, ingredients: List[str], target_rarity: str) -> bool:
        count = len(ingredients)
        has_mythic = self.has_mythic_catalyst(ingredients)

        rarity_requirements = {
            "Common":    (1, False),
            "Uncommon":  (2, False),
            "Rare":      (3, False),
            "Epic":      (4, False),
            "Legendary": (5, False),
            "Mythic":    (5, True),
        }
        req_count, req_mythic = rarity_requirements.get(target_rarity, (1, False))
        if count < req_count:
            return False
        if req_mythic and not has_mythic:
            return False
        return True

    def get_all_ingredients_json(self) -> List[dict]:
        return [
            {
                "id": ing.id,
                "name": ing.name,
                "category": ing.category.value,
                "rarity_weight": ing.rarity_weight,
                "description": ing.description,
                "special_effect": ing.special_effect.value,
                "unlock_level": ing.unlock_level,
                "emoji": ing.emoji,
                "color": ing.color,
            }
            for ing in self.ingredients.values()
        ]

    def get_category_info(self) -> List[dict]:
        return [
            {
                "category": cat.value,
                "color": style["color"],
                "bg_gradient": style["bg_gradient"],
                "border": style["border"],
                "glow": style["glow"],
                "name": style["name"],
                "unlock_range": style["unlock_range"],
            }
            for cat, style in self.category_styles.items()
        ]


# Recipe templates — refreshed for Season 2
RECIPE_TEMPLATES = [
    {
        "id": "TREAT_S2_001",
        "name": "Pupcorn Crunch Combo",
        "rarity": "Common",
        "ingredients": ["S2_001", "S2_003"],
        "visual_effect": "None",
        "description": "Classic combo of pupcorn and biscuit crumbs.",
    },
    {
        "id": "TREAT_S2_002",
        "name": "Moonbone Lunar Snack",
        "rarity": "Rare",
        "ingredients": ["S2_008", "S2_011", "S2_014"],
        "visual_effect": "Glow",
        "description": "A glowing lunar treat for night-time gains.",
    },
    {
        "id": "TREAT_S2_003",
        "name": "Cyber Rocket Supreme",
        "rarity": "Epic",
        "ingredients": ["S2_006", "S2_021", "S2_026", "S2_017"],
        "visual_effect": "Animated Flames",
        "description": "High-octane treat blasting with cybernetic crunch.",
    },
    {
        "id": "TREAT_S2_004",
        "name": "Nebula Royal Crunch",
        "rarity": "Legendary",
        "ingredients": ["S2_031", "S2_032", "S2_037", "S2_039", "S2_023"],
        "visual_effect": "Hologram",
        "description": "Galactic royalty in every bite.",
    },
    {
        "id": "TREAT_S2_005",
        "name": "Godtier Genesis Treat",
        "rarity": "Mythic",
        "ingredients": ["S2_050", "S2_041", "S2_045", "S2_047", "S2_040"],
        "visual_effect": "Unique Aura",
        "description": "The first treat of the gods. Forged in Mythic fire.",
    },
]
