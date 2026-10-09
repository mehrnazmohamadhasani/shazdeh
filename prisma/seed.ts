import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { pgConnectionString } from "../src/lib/pg-connection";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString: pgConnectionString(connectionString),
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type SeedItem = {
  slug: string;
  name: string;
  nameFa?: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isVegetarian?: boolean;
};

type SeedCategory = {
  slug: string;
  name: string;
  order: number;
  items: SeedItem[];
};

const IMG = (file: string) => `/menu/${file}`;

const CATEGORIES: SeedCategory[] = [
  {
    slug: "mains",
    name: "Main Dishes",
    order: 1,
    items: [
      {
        slug: "gheimeh-bademjan",
        name: "Gheimeh Bademjan",
        nameFa: "قیمه بادمجان",
        description:
          "Tender lamb stew braised with split yellow peas, tomato, dried lime, and roasted aubergine — finished with crisped potato straws.",
        price: 128,
        imageUrl: IMG("gheimeh-bademjan.jpg"),
      },
      {
        slug: "ghormeh-sabzi",
        name: "Ghormeh Sabzi",
        nameFa: "قورمه سبزی",
        description:
          "Iran's national stew — slow-cooked herbs, kidney beans, dried lime and lamb, served with steamed saffron basmati.",
        price: 128,
        imageUrl: IMG("ghormeh-sabzi.jpg"),
      },
      {
        slug: "karafs",
        name: "Karafs",
        nameFa: "خورش کرفس",
        description:
          "Aromatic celery and parsley stew with lamb, brightened with fresh mint and lime.",
        price: 138,
        imageUrl: IMG("karafs.jpg"),
      },
      {
        slug: "loobia-polo",
        name: "Loobia Polo",
        nameFa: "لوبیا پلو",
        description:
          "Layered green-bean and saffron rice cooked with cinnamon-spiced minced lamb — a warm, comforting weekday classic.",
        price: 128,
        imageUrl: IMG("loobia-polo.jpg"),
      },
      {
        slug: "baghali-polo-mahiche",
        name: "Baghali Polo ba Mahiche",
        nameFa: "باقالی پلو با ماهیچه",
        description:
          "Fava beans and dill scented basmati rice, paired with melt-off-the-bone braised lamb shank.",
        price: 138,
        imageUrl: IMG("baghali-polo-mahiche.jpg"),
      },
      {
        slug: "zereshk-polo-morgh",
        name: "Zereshk Polo Morgh",
        nameFa: "زرشک پلو مرغ",
        description:
          "Saffron rice jeweled with tart barberries, served with slow-braised chicken in a warm tomato-saffron glaze.",
        price: 98,
        imageUrl: IMG("zereshk-polo-morgh.jpg"),
      },
      {
        slug: "fesenjan",
        name: "Fesenjan",
        nameFa: "فسنجان",
        description:
          "Roasted walnuts and pomegranate molasses simmered slowly with chicken — sweet, sour, deeply nutty.",
        price: 118,
        imageUrl: IMG("fesenjoon.jpg"),
      },
      {
        slug: "kabab-digi",
        name: "Kabab Digi",
        nameFa: "کباب دیگی",
        description:
          "A Tehran-style pan-cooked kabab — minced lamb and beef seasoned with onion and turmeric, served on saffron rice.",
        price: 118,
        imageUrl: IMG("kabab-digi.jpg"),
      },
      {
        slug: "adas-polo",
        name: "Adas Polo",
        nameFa: "عدس پلو",
        description:
          "Lentil basmati rice layered with caramelized onions, raisins and dates — finished with cinnamon-spiced lamb.",
        price: 108,
        imageUrl: IMG("adas-polo.jpg"),
      },
      {
        slug: "morgh-bademjan",
        name: "Morgh Bademjan",
        nameFa: "مرغ بادمجان",
        description:
          "Roasted aubergine and chicken in a delicate tomato-saffron sauce, finished with dried lime.",
        price: 98,
        imageUrl: IMG("morgh-badenjoon.jpg"),
      },
      {
        slug: "makaroni",
        name: "Makaroni",
        nameFa: "ماکارونی",
        description:
          "Tehran-style pasta with spiced tomato beef ragu — slow-built tahdig crust, golden and crisp on top.",
        price: 98,
        imageUrl: IMG("makaroni.jpg"),
      },
      {
        slug: "shazdeh-mix",
        name: "SHĀZDEH Mix",
        nameFa: "ترکیب شازده",
        description:
          "Our signature tasting plate — chef's selection of three rotating khoresh, served with saffron rice and tahdig.",
        price: 98,
        imageUrl: IMG("shazdeh-mix.jpg"),
      },
      {
        slug: "ghormeh-sabzi-tahchin",
        name: "Ghormeh Sabzi Tahchin",
        nameFa: "ته‌چین قورمه سبزی",
        description:
          "Ghormeh sabzi — slow-cooked herbs, kidney beans, dried lime and lamb — baked inside a golden saffron tahdig crust.",
        price: 98,
      },
      {
        slug: "gheimeh-bademjan-tahchin",
        name: "Gheimeh Bademjan Tahchin",
        nameFa: "ته‌چین قیمه بادمجان",
        description:
          "Lamb, split peas, tomato and fried aubergine, baked inside a golden saffron tahdig crust.",
        price: 98,
      },
      {
        slug: "karafs-tahchin",
        name: "Karafs Tahchin",
        nameFa: "ته‌چین خورش کرفس",
        description:
          "Celery, fresh herbs and tender lamb stew, baked inside a golden saffron tahdig crust.",
        price: 98,
      },
      {
        slug: "zereshk-polo-tahchin",
        name: "Zereshk Polo Tahchin",
        nameFa: "ته‌چین زرشک پلو",
        description:
          "Saffron chicken and tart barberries baked inside a golden saffron tahdig crust.",
        price: 88,
      },
      {
        slug: "baghali-polo-tahchin",
        name: "Baghali Polo Tahchin",
        nameFa: "ته‌چین باقالی پلو",
        description:
          "Tender braised lamb baked between layers of dill and fava bean saffron rice, with a golden tahdig crust.",
        price: 115,
      },
      {
        slug: "kabab-digi-tahchin",
        name: "Kabab Digi Tahchin",
        nameFa: "ته‌چین کباب دیگی",
        description:
          "Tehran-style pan-cooked kabab and tomato baked inside a golden saffron tahdig crust.",
        price: 99,
      },
    ],
  },
  {
    slug: "vegetarian",
    name: "Vegetarian",
    order: 2,
    items: [
      {
        slug: "gheimeh-bademjan-veg",
        name: "Gheimeh Bademjan",
        nameFa: "قیمه بادمجان (گیاهی)",
        description:
          "Yellow split peas braised with tomato, dried lime, and roasted aubergine. Served with saffron basmati.",
        price: 98,
        imageUrl: IMG("gheimeh-bademjan-veg.jpg"),
        isVegetarian: true,
      },
      {
        slug: "ghormeh-sabzi-veg",
        name: "Ghormeh Sabzi",
        nameFa: "قورمه سبزی (گیاهی)",
        description:
          "Slow-cooked herbs, kidney beans and dried lime — a fully plant-based take on Iran's national stew.",
        price: 98,
        imageUrl: IMG("ghormeh-sabzi-veg.jpg"),
        isVegetarian: true,
      },
      {
        slug: "karafs-veg",
        name: "Karafs",
        nameFa: "خورش کرفس (گیاهی)",
        description:
          "Celery and parsley simmered in fresh herbs and lime — a green, bright vegetarian khoresh.",
        price: 98,
        imageUrl: IMG("karafs-veg.jpg"),
        isVegetarian: true,
      },
      {
        slug: "loobia-polo-veg",
        name: "Loobia Polo",
        nameFa: "لوبیا پلو (گیاهی)",
        description:
          "Green beans, tomato and warm spices folded into layered saffron basmati.",
        price: 88,
        imageUrl: IMG("loobia-polo.jpg"),
        isVegetarian: true,
      },
      {
        slug: "kashke-bademjan",
        name: "Kashke Bademjan",
        nameFa: "کشک بادمجان",
        description:
          "Smoky charred aubergine, caramelized onion, mint oil and creamy whey kashk — finished with crispy garlic.",
        price: 44,
        imageUrl: IMG("kashke-bademjoon.jpg"),
        isVegetarian: true,
      },
    ],
  },
  {
    slug: "sides",
    name: "Sides",
    order: 3,
    items: [
      {
        slug: "mast-bademjan",
        name: "Mast Bademjan",
        nameFa: "ماست بادمجان",
        description:
          "Smoked aubergine folded into thick yoghurt with caramelized onion and saffron oil.",
        price: 36,
        imageUrl: IMG("mast-bademjoon.jpg"),
        isVegetarian: true,
      },
      {
        slug: "mast-chekideh",
        name: "Mast Chekideh",
        nameFa: "ماست چکیده",
        description:
          "Strained Persian yoghurt, finished with extra-virgin olive oil and crushed walnuts.",
        price: 29,
        imageUrl: IMG("mast-chekideh.jpg"),
        isVegetarian: true,
      },
      {
        slug: "mast-khiar",
        name: "Mast Khiar",
        nameFa: "ماست خیار",
        description:
          "Cool yoghurt with crisp Persian cucumbers, mint, walnuts, raisins and dried rose petals.",
        price: 29,
        imageUrl: IMG("mast-khiar.jpg"),
        isVegetarian: true,
      },
      {
        slug: "homemade-torshi",
        name: "Homemade Torshi",
        nameFa: "ترشی خانگی",
        description:
          "House-pickled vegetables in aged vinegar — sharp, briny, traditional.",
        price: 38,
        imageUrl: IMG("homemade-torshi.jpg"),
        isVegetarian: true,
      },
      {
        slug: "salad-shirazi",
        name: "Salad Shirazi",
        nameFa: "سالاد شیرازی",
        description:
          "Diced cucumber, tomato and red onion, dressed in lime, mint and olive oil.",
        price: 36,
        isVegetarian: true,
      },
      {
        slug: "sabzi-khordan-large",
        name: "Sabzi Khordan — Large",
        nameFa: "سبزی خوردن (بزرگ)",
        description:
          "An abundant platter of fresh Persian herbs, radish, walnuts, feta and warm sangak bread.",
        price: 38,
        imageUrl: IMG("sabzi-khordan.jpg"),
        isVegetarian: true,
      },
      {
        slug: "sabzi-khordan-small",
        name: "Sabzi Khordan — Small",
        nameFa: "سبزی خوردن (کوچک)",
        description:
          "A small platter of fresh herbs, walnuts and feta, served with warm bread.",
        price: 25,
        isVegetarian: true,
      },
    ],
  },
  {
    slug: "drinks",
    name: "Drinks",
    order: 4,
    items: [
      {
        slug: "zafaran",
        name: "Zafaran",
        nameFa: "زعفران",
        description:
          "Iced saffron-rose lemonade with a whisper of cardamom — our signature drink.",
        price: 38,
        imageUrl: IMG("zafaran.jpg"),
        isVegetarian: true,
      },
      {
        slug: "bahar-narenj",
        name: "Bahar Narenj",
        nameFa: "بهار نارنج",
        description:
          "Sparkling orange-blossom infusion — floral, light, deeply Iranian.",
        price: 32,
        imageUrl: IMG("bahar-narenj.jpg"),
        isVegetarian: true,
      },
      {
        slug: "khiar-sekanjabin",
        name: "Khiar Sekanjabin",
        nameFa: "خیار سکنجبین",
        description:
          "Persian cucumber, mint, vinegar and honey-saffron syrup — a 2,500-year-old refresher.",
        price: 36,
        imageUrl: IMG("khiar-sekanjabin.jpg"),
        isVegetarian: true,
      },
      {
        slug: "lemonade",
        name: "Lemonade",
        nameFa: "لیموناد",
        description: "Hand-pressed lemonade, gently sweetened.",
        price: 34,
        imageUrl: IMG("lemonade.jpg"),
        isVegetarian: true,
      },
      {
        slug: "coca-cola",
        name: "Coca-Cola",
        description: "Chilled, classic.",
        price: 15,
        isVegetarian: true,
      },
      {
        slug: "coke-zero",
        name: "Coke Zero",
        description: "Chilled, sugar-free.",
        price: 15,
        isVegetarian: true,
      },
      {
        slug: "soda-water",
        name: "Soda Water",
        description: "Sparkling and clean.",
        price: 14,
        isVegetarian: true,
      },
    ],
  },
];

async function main() {
  console.log("→ Seeding Shazdeh database…");

  // Admin user
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@shazdeh.ae";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "shazdeh-admin";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: "ADMIN" },
    create: {
      email: adminEmail,
      passwordHash,
      name: "SHĀZDEH Admin",
      role: "ADMIN",
    },
  });
  console.log(`  ✓ Admin user → ${adminEmail}`);

  // Restaurant settings
  await prisma.restaurantSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      brandName: "SHĀZDEH",
      description:
        "A contemporary Persian food brand rooted in heritage and expressed through a modern visual language. Inspired by Persian culture, craftsmanship and hospitality, set in Dubai for a global table.",
      email: "hello@shazdeh.ae",
      phone: "+971 4 000 0000",
      whatsapp: "971500000000",
      address: "Dubai, United Arab Emirates",
      openingHours: JSON.stringify({
        mon: "12:00 — 23:00",
        tue: "12:00 — 23:00",
        wed: "12:00 — 23:00",
        thu: "12:00 — 23:00",
        fri: "12:00 — 00:00",
        sat: "12:00 — 00:00",
        sun: "12:00 — 23:00",
      }),
      metaTitle: "SHĀZDEH — Persian Cuisine · Dubai",
      metaDesc:
        "SHĀZDEH — a contemporary Persian food brand in Dubai. Persian cuisine, refined hospitality, editorial dining.",
    },
  });
  console.log("  ✓ Restaurant settings");

  // Categories + items
  for (const cat of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        order: cat.order,
        isActive: true,
      },
      create: {
        slug: cat.slug,
        name: cat.name,
        order: cat.order,
        isActive: true,
      },
    });

    let order = 0;
    for (const item of cat.items) {
      order += 1;
      await prisma.menuItem.upsert({
        where: { slug: item.slug },
        update: {
          name: item.name,
          nameFa: item.nameFa ?? null,
          description: item.description ?? null,
          price: item.price,
          imageUrl: item.imageUrl ?? null,
          isVegetarian: item.isVegetarian ?? false,
          order,
          categoryId: category.id,
        },
        create: {
          slug: item.slug,
          name: item.name,
          nameFa: item.nameFa ?? null,
          description: item.description ?? null,
          price: item.price,
          imageUrl: item.imageUrl ?? null,
          isVegetarian: item.isVegetarian ?? false,
          order,
          categoryId: category.id,
        },
      });
    }
    console.log(`  ✓ ${cat.name} (${cat.items.length} items)`);
  }

  // Gallery
  await prisma.galleryImage.deleteMany();
  const galleryFiles = [
    "ghormeh-sabzi.jpg",
    "fesenjoon.jpg",
    "zereshk-polo-morgh.jpg",
    "baghali-polo-mahiche.jpg",
    "kabab-digi.jpg",
    "kashke-bademjoon.jpg",
    "shazdeh-mix.jpg",
    "sabzi-khordan.jpg",
    "zafaran.jpg",
    "khiar-sekanjabin.jpg",
    "homemade-torshi.jpg",
    "mast-bademjoon.jpg",
  ];
  await prisma.galleryImage.createMany({
    data: galleryFiles.map((f, i) => ({
      imageUrl: IMG(f),
      order: i + 1,
    })),
  });
  console.log(`  ✓ Gallery (${galleryFiles.length} images)`);

  // Social links
  await prisma.socialLink.deleteMany();
  await prisma.socialLink.createMany({
    data: [
      {
        platform: "instagram",
        label: "Instagram",
        url: "https://instagram.com/shazdeh",
        order: 1,
      },
      {
        platform: "whatsapp",
        label: "WhatsApp",
        url: "https://wa.me/971500000000",
        order: 2,
      },
      {
        platform: "talabat",
        label: "Talabat",
        url: "https://talabat.com",
        order: 3,
      },
      {
        platform: "deliveroo",
        label: "Deliveroo",
        url: "https://deliveroo.ae",
        order: 4,
      },
      {
        platform: "careem",
        label: "Careem",
        url: "https://careem.com",
        order: 5,
      },
    ],
  });
  console.log("  ✓ Social links");

  await seedOrdering();

  console.log("✓ Seed complete.\n");
  console.log(`  Login → ${adminEmail}`);
  console.log(`  Pass  → ${adminPassword}`);
}

/*
 * Online ordering. The real seed only creates the settings row with
 * ordering switched OFF — zones, fees and add-ons must come from the
 * restaurant owner (Admin → Delivery zones / Ordering).
 *
 * SEED_DEMO_ORDERING=1 adds illustrative zones, Dubai communities,
 * add-ons and a promo code so the full flow can be tried locally.
 * Never run it against production: the fees, areas and add-ons are
 * placeholders, not SHĀZDEH's real terms.
 */
const DEMO_ZONES = [
  {
    name: "Central",
    fee: 7,
    minOrder: 60,
    freeDeliveryOver: 200,
    etaMin: 30,
    etaMax: 45,
    areas: [
      ["Downtown Dubai", 25.1972, 55.2744],
      ["Business Bay", 25.185, 55.265],
      ["DIFC", 25.212, 55.28],
      ["City Walk", 25.205, 55.262],
      ["Al Wasl", 25.195, 55.25],
      ["Jumeirah 1", 25.221, 55.256],
      ["Al Quoz", 25.14, 55.23],
    ],
  },
  {
    name: "Coast & Hills",
    fee: 12,
    minOrder: 80,
    freeDeliveryOver: 250,
    etaMin: 40,
    etaMax: 55,
    areas: [
      ["Al Barsha", 25.11, 55.2],
      ["Dubai Hills Estate", 25.11, 55.245],
      ["Palm Jumeirah", 25.1124, 55.139],
      ["Dubai Marina", 25.0805, 55.1403],
      ["Jumeirah Lake Towers (JLT)", 25.07, 55.143],
      ["Jumeirah Beach Residence (JBR)", 25.078, 55.133],
    ],
  },
  {
    name: "Outer Dubai",
    fee: 18,
    minOrder: 120,
    freeDeliveryOver: null,
    etaMin: 50,
    etaMax: 65,
    areas: [
      ["Jumeirah Village Circle (JVC)", 25.06, 55.21],
      ["Arabian Ranches", 25.055, 55.27],
      ["Deira", 25.27, 55.31],
      ["Bur Dubai", 25.255, 55.295],
      ["Mirdif", 25.22, 55.42],
    ],
  },
] as const;

const DEMO_KHORESH = [
  "gheimeh-bademjan",
  "ghormeh-sabzi",
  "karafs",
  "fesenjan",
  "gheimeh-bademjan-veg",
  "ghormeh-sabzi-veg",
  "karafs-veg",
];

async function seedOrdering() {
  const demo = process.env.SEED_DEMO_ORDERING === "1";

  await prisma.orderingSettings.upsert({
    where: { id: "default" },
    update: demo ? { acceptingOrders: true, deliveryHours: DEMO_HOURS } : {},
    create: {
      id: "default",
      acceptingOrders: demo,
      deliveryHours: demo ? DEMO_HOURS : null,
    },
  });
  console.log(`  ✓ Ordering settings (accepting orders: ${demo ? "on — demo" : "off"})`);
  if (!demo) return;

  if ((await prisma.deliveryZone.count()) === 0) {
    let order = 0;
    for (const z of DEMO_ZONES) {
      await prisma.deliveryZone.create({
        data: {
          name: z.name,
          fee: z.fee,
          minOrder: z.minOrder,
          freeDeliveryOver: z.freeDeliveryOver,
          etaMin: z.etaMin,
          etaMax: z.etaMax,
          order: order++,
          areas: {
            create: z.areas.map(([name, lat, lng]) => ({ name, lat, lng })),
          },
        },
      });
    }
    console.log("  ✓ Demo delivery zones");
  }

  for (const slug of DEMO_KHORESH) {
    const item = await prisma.menuItem.findUnique({
      where: { slug },
      include: { _count: { select: { modifierGroups: true } } },
    });
    if (!item || item._count.modifierGroups > 0) continue;
    await prisma.modifierGroup.create({
      data: {
        itemId: item.id,
        name: "Rice",
        minSelect: 1,
        maxSelect: 1,
        order: 0,
        options: {
          create: [
            { name: "Saffron basmati", price: 0, order: 0 },
            { name: "Saffron basmati with tahdig", price: 10, order: 1 },
          ],
        },
      },
    });
    await prisma.modifierGroup.create({
      data: {
        itemId: item.id,
        name: "Extras",
        minSelect: 0,
        maxSelect: 3,
        order: 1,
        options: {
          create: [
            { name: "Extra saffron rice", price: 14, order: 0 },
            { name: "Extra khoresh", price: 22, order: 1 },
            { name: "Fresh herbs (sabzi)", price: 9, order: 2 },
          ],
        },
      },
    });
  }
  console.log("  ✓ Demo add-ons on khoresh dishes");

  await prisma.coupon.upsert({
    where: { code: "NOOSH10" },
    update: {},
    create: {
      code: "NOOSH10",
      description: "10% off — demo promo",
      type: "PERCENT",
      value: 10,
      minSubtotal: 80,
      maxDiscount: 30,
      perPhoneLimit: 1,
    },
  });
  console.log("  ✓ Demo promo code NOOSH10");
}

const DEMO_HOURS = JSON.stringify(
  Object.fromEntries(
    ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, "00:00 — 23:59"]),
  ),
);

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
