const data = [
    {
        pokemon: "vulpix",
        tier: 0.395
    },
    {
        pokemon: "ninetales",
        tier: 0.395
    },
    {
        pokemon: "abra",
        tier: 0.5
    },
    {
        pokemon: "kadabra",
        tier: 0.5
    },
    {
        pokemon: "alakazam",
        tier: 0.5
    },
    {
        pokemon: "gastly",
        tier: 0.5
    },
    {
        pokemon: "haunter",
        tier: 0.5
    },
    {
        pokemon: "gengar",
        tier: 0.5
    },
    {
        pokemon: "natu",
        tier: 0.5
    },
    {
        pokemon: "xatu",
        tier: 0.5
    },
    {
        pokemon: "unown",
        tier: 0.5
    },
    {
        pokemon: "lunatone",
        tier: 0.5
    },
    {
        pokemon: "solrock",
        tier: 0.5
    },
    {
        pokemon: "baltoy",
        tier: 0.5
    },
    {
        pokemon: "claydol",
        tier: 0.5
    },
    {
        pokemon: "duskull",
        tier: 0.5
    },
    {
        pokemon: "dusclops",
        tier: 0.5
    },
    {
        pokemon: "chimecho",
        tier: 0.5
    },
    {
        pokemon: "absol",
        tier: 0.5
    },
    {
        pokemon: "chingling",
        tier: 0.5
    },
    {
        pokemon: "bronzor",
        tier: 0.5
    },
    {
        pokemon: "bronzong",
        tier: 0.5
    },
    {
        pokemon: "spiritomb",
        tier: 0.5
    },
    {
        pokemon: "dusknoir",
        tier: 0.5
    },
    {
        pokemon: "munna",
        tier: 0.5
    },
    {
        pokemon: "musharna",
        tier: 0.5
    },
    {
        pokemon: "darumaka",
        tier: 0.395
    },
    {
        pokemon: "darmanitan",
        tier: 0.395
    },
    {
        pokemon: "sigilyph",
        tier: 0.5
    },
    {
        pokemon: "yamask",
        tier: 0.5
    },
    {
        pokemon: "cofagrigus",
        tier: 0.5
    },
    {
        pokemon: "elgyem",
        tier: 0.5
    },
    {
        pokemon: "beheeyem",
        tier: 0.5
    },
    {
        pokemon: "litwick",
        tier: 0.5
    },
    {
        pokemon: "lampent",
        tier: 0.5
    },
    {
        pokemon: "chandelure",
        tier: 0.5
    },
    {
        pokemon: "golett",
        tier: 0.5
    },
    {
        pokemon: "golurk",
        tier: 0.5
    },
    {
        pokemon: "volcarona",
        tier: 0.5
    },
    {
        pokemon: "honedge",
        tier: 0.5
    },
    {
        pokemon: "doublade",
        tier: 0.5
    },
    {
        pokemon: "aegislash",
        tier: 0.5
    },
    {
        pokemon: "sinistea",
        tier: 0.5
    },
    {
        pokemon: "polteageist",
        tier: 0.5
    },
    {
        pokemon: "runerigus",
        tier: 0.5
    },
    {
        pokemon: "falinks",
        tier: 0.395
    },
    {
        pokemon: "stonjourner",
        tier: 0.5
    },
    {
        pokemon: "charcadet",
        tier: 0.395
    },
    {
        pokemon: "armarouge",
        tier: 0.5
    },
    {
        pokemon: "ceruledge",
        tier: 0.5
    },
    {
        pokemon: "tinkatink",
        tier: 0.395
    },
    {
        pokemon: "tinkatuff",
        tier: 0.395
    },
    {
        pokemon: "tinkaton",
        tier: 0.395
    },
    {
        pokemon: "greavard",
        tier: 0.5
    },
    {
        pokemon: "houndstone",
        tier: 0.5
    },
    {
        pokemon: "gholdengo",
        tier: 0.5
    }
]

const total = data.reduce((acc, curr) => acc + curr.tier, 0);

const normalized = data.map(item => ({ ...item, tier: item.tier / total }));

const onormalized = normalized.map(item => ({ ...item, tier: item.tier * data.length }));

const newTotal = onormalized.reduce((acc, curr) => acc + curr.tier, 0);

const small = onormalized.filter(item => item.tier < 1);
const large = onormalized.filter(item => item.tier >= 1);

console.log("Small:", structuredClone(small));
console.log("Large:", structuredClone(large));
console.log("Small length:", small.length);
console.log("Large length:", large.length);
console.log("Small total:", small.reduce((a, b) => a + b.tier, 0));
console.log("Large total:", large.reduce((a, b) => a + b.tier, 0));