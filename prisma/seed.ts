/* eslint-disable no-console */
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const url = databaseUrl.startsWith("file:")
  ? path.resolve(process.cwd(), databaseUrl.slice("file:".length))
  : databaseUrl;

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url }),
});

type SeedItem = {
  slug: string;
  name: string;
  nameFa?: string;
  description?: string;
  story?: string;
  price: number;
  imageUrl?: string;
  spicyLevel?: number;
  isVegetarian?: boolean;
  isBestseller?: boolean;
  isNew?: boolean;
  isSignature?: boolean;
};

type SeedCategory = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  order: number;
  items: SeedItem[];
};

const IMG = (file: string) => `/menu/${file}`;

const CATEGORIES: SeedCategory[] = [
  {
    slug: "mains",
    name: "Main Dishes",
    tagline: "The heart of the table",
    description:
      "Our signature Persian khoresh and polo — slow-cooked, aromatic, and built around generations of Iranian craft.",
    order: 1,
    items: [
      {
        slug: "gheimeh-bademjan",
        name: "Gheimeh Bademjan",
        nameFa: "قیمه بادمجان",
        description:
          "Tender lamb stew braised with split yellow peas, tomato, dried lime, and roasted aubergine — finished with crisped potato straws.",
        story:
          "A Persian classic with deep rust-red color and the gentle perfume of dried lime (limoo amani).",
        price: 128,
        imageUrl: IMG("gheimeh-bademjan.jpg"),
        isBestseller: true,
        isSignature: true,
      },
      {
        slug: "ghormeh-sabzi",
        name: "Ghormeh Sabzi",
        nameFa: "قورمه سبزی",
        description:
          "Iran's national stew — slow-cooked herbs, kidney beans, dried lime and lamb, served with steamed saffron basmati.",
        price: 128,
        imageUrl: IMG("ghormeh-sabzi.jpg"),
        isBestseller: true,
        isSignature: true,
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
        price: 128,
        imageUrl: IMG("baghali-polo-mahiche.jpg"),
        isSignature: true,
      },
      {
        slug: "zereshk-polo-morgh",
        name: "Zereshk Polo Morgh",
        nameFa: "زرشک پلو مرغ",
        description:
          "Saffron rice jeweled with tart barberries, served with slow-braised chicken in a warm tomato-saffron glaze.",
        price: 98,
        imageUrl: IMG("zereshk-polo-morgh.jpg"),
        isBestseller: true,
      },
      {
        slug: "fesenjan",
        name: "Fesenjan",
        nameFa: "فسنجان",
        description:
          "Roasted walnuts and pomegranate molasses simmered slowly with chicken — sweet, sour, deeply nutty.",
        price: 118,
        imageUrl: IMG("fesenjoon.jpg"),
        isSignature: true,
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
        price: 98,
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
        price: 88,
        imageUrl: IMG("makaroni.jpg"),
        isNew: true,
      },
      {
        slug: "shazdeh-mix",
        name: "SHĀZDEH Mix",
        nameFa: "ترکیب شازده",
        description:
          "Our signature tasting plate — chef's selection of three rotating khoresh, served with saffron rice and tahdig.",
        price: 98,
        imageUrl: IMG("shazdeh-mix.jpg"),
        isSignature: true,
        isNew: true,
      },
    ],
  },
  {
    slug: "vegetarian",
    name: "Vegetarian",
    tagline: "Plant-forward Persian",
    description:
      "Soulful Persian classics, reinterpreted entirely from the garden — no meat, no compromise.",
    order: 2,
    items: [
      {
        slug: "gheimeh-bademjan-veg",
        name: "Gheimeh Bademjan",
        nameFa: "قیمه بادمجان (گیاهی)",
        description:
          "Yellow split peas braised with tomato, dried lime, and roasted aubergine. Served with saffron basmati.",
        price: 88,
        imageUrl: IMG("gheimeh-bademjan-veg.jpg"),
        isVegetarian: true,
      },
      {
        slug: "ghormeh-sabzi-veg",
        name: "Ghormeh Sabzi",
        nameFa: "قورمه سبزی (گیاهی)",
        description:
          "Slow-cooked herbs, kidney beans and dried lime — a fully plant-based take on Iran's national stew.",
        price: 88,
        imageUrl: IMG("ghormeh-sabzi-veg.jpg"),
        isVegetarian: true,
      },
      {
        slug: "karafs-veg",
        name: "Karafs",
        nameFa: "خورش کرفس (گیاهی)",
        description:
          "Celery and parsley simmered in fresh herbs and lime — a green, bright vegetarian khoresh.",
        price: 88,
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
        isBestseller: true,
      },
    ],
  },
  {
    slug: "sides",
    name: "Sides",
    tagline: "The Persian table",
    description:
      "Cooling yoghurts, fresh herbs and house-made pickles — the rituals that complete a Persian table.",
    order: 3,
    items: [
      {
        slug: "mast-bademjan",
        name: "Mast Bademjan",
        nameFa: "ماست بادمجان",
        description:
          "Smoked aubergine folded into thick yoghurt with caramelized onion and saffron oil.",
        price: 34,
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
        price: 36,
        imageUrl: IMG("homemade-torshi.jpg"),
        isVegetarian: true,
      },
      {
        slug: "salad-shirazi",
        name: "Salad Shirazi",
        nameFa: "سالاد شیرازی",
        description:
          "Diced cucumber, tomato and red onion, dressed in lime, mint and olive oil.",
        price: 29,
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
        price: 22,
        isVegetarian: true,
      },
    ],
  },
  {
    slug: "drinks",
    name: "Drinks",
    tagline: "Liquid heritage",
    description:
      "Persian-inspired refreshers and classics — saffron, sour cherry, sekanjabin and more.",
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
        isSignature: true,
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
      tagline: "Persian Cuisine",
      description:
        "A contemporary Persian food brand rooted in heritage and expressed through a modern visual language. Inspired by Persian culture, craftsmanship and hospitality, set in Dubai for a global table.",
      email: "hello@shazdeh.ae",
      phone: "+971 4 000 0000",
      whatsapp: "971500000000",
      address: "Dubai, United Arab Emirates",
      mapUrl: "https://maps.google.com/?q=Dubai",
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
        tagline: cat.tagline,
        description: cat.description,
        order: cat.order,
        isActive: true,
      },
      create: {
        slug: cat.slug,
        name: cat.name,
        tagline: cat.tagline,
        description: cat.description,
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
          story: item.story ?? null,
          price: item.price,
          imageUrl: item.imageUrl ?? null,
          spicyLevel: item.spicyLevel ?? 0,
          isVegetarian: item.isVegetarian ?? false,
          isBestseller: item.isBestseller ?? false,
          isNew: item.isNew ?? false,
          isSignature: item.isSignature ?? false,
          order,
          categoryId: category.id,
        },
        create: {
          slug: item.slug,
          name: item.name,
          nameFa: item.nameFa ?? null,
          description: item.description ?? null,
          story: item.story ?? null,
          price: item.price,
          currency: "AED",
          imageUrl: item.imageUrl ?? null,
          spicyLevel: item.spicyLevel ?? 0,
          isVegetarian: item.isVegetarian ?? false,
          isBestseller: item.isBestseller ?? false,
          isNew: item.isNew ?? false,
          isSignature: item.isSignature ?? false,
          order,
          categoryId: category.id,
        },
      });
    }
    console.log(`  ✓ ${cat.name} (${cat.items.length} items)`);
  }

  // Banners
  await prisma.banner.deleteMany();
  await prisma.banner.createMany({
    data: [
      {
        title: "From our heart to your home.",
        subtitle:
          "A contemporary Persian table set in Dubai — plated with the calm precision of an editorial kitchen.",
        ctaLabel: "View the menu",
        ctaHref: "/menu",
        imageUrl: IMG("ghormeh-sabzi.jpg"),
        position: "home_hero",
        order: 1,
      },
      {
        title: "Signature Tasting — SHĀZDEH Mix",
        subtitle:
          "Three rotating khoresh, saffron rice, golden tahdig.",
        ctaLabel: "Discover",
        ctaHref: "/menu/mains/shazdeh-mix",
        imageUrl: IMG("shazdeh-mix.jpg"),
        position: "home_secondary",
        order: 1,
      },
    ],
  });
  console.log("  ✓ Banners");

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
      title: f.replace(/[-_.]/g, " ").replace(/\.jpg$/, ""),
      imageUrl: IMG(f),
      order: i,
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

  console.log("✓ Seed complete.\n");
  console.log(`  Login → ${adminEmail}`);
  console.log(`  Pass  → ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
