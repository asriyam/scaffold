import { MerchandizingCarouselGroup, MerchandizingTile } from "@/types/merchandizing-tiles.model";

export const merchandizingCarouselData: MerchandizingCarouselGroup[] = [
  {
    id: "carousel-group-1",
    tiles: [
      {
        id: "tile-1",
        badge: "Spring Sale",
        title: "Start Fresh With Seasonal Savings",
        description: "It's the perfect time for a tech refresh with great discounts on our monitors, accessories, and more.",
        ctaText: "View The Deals",
        ctaLink: "https://www.dell.com/en-us/shop/deals/pc-accessories-deals",
        image: {
          src: "//i.dell.com/is/image/DellContent/content/dam/ss2/page-specific/dell-homepage/na/heroes/fy27q1w9-na-spring-sale-s3425dw-km7321w-site-banner-1800x800.png?fmt=png-alpha&wid=1800&hei=800",
          alt: "Spring Sale",
          width: 1800,
          height: 800,
        },
        metrics: '{"btnname":"supercategory|lefttile1|View The Deals"}',
      },
      {
        id: "tile-2",
        title: "Bundle & Save. Simple as That.",
        description: "Explore curated bundles featuring Dell and Alienware",
        ctaText: "Shop Bundle Deals",
        ctaLink: "https://www.dell.com/en-us/shop/deals/pc-accessories-bundles",
        image: {
          src: "//i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/peripherals/bundles/dell-km555-cc3724-wl3024-wb3023-combo/dell-cp3724-wl3024-wb3023-km555-blk-combo-1800x800.png?fmt=png-alpha&wid=1800&hei=800",
          alt: "Accessories bundle image",
          width: 1800,
          height: 800,
        },
        metrics: '{"btnname":"supercategory|lefttile2|Shop Bundle Deals"}',
      },
    ],
  },
  {
    id: "carousel-group-2",
    tiles: [
      {
        id: "tile-3",
        badge: "Dell Pro Plus Earbuds",
        title: "Crystal-clear communication",
        description: "Enjoy distraction free calls with an AI-based noise cancelling mic and seamless connectivity.",
        ctaText: "Shop Now",
        ctaLink: "https://www.dell.com/en-us/shop/dell-pro-plus-earbuds-eb525/apd/520-bbnf/pc-accessories",
        image: {
          src: "//i.dell.com/is/image/DellContent/content/dam/documents-and-videos/dv2/pan-dell/en/product-launch/peripherals/headsets/eb525-pro-plus-earbuds/site-banners/2601g0080-gl-fy26-dell-pro-plus-earbuds-eb525-site-banner-1800x800.png?fmt=png-alpha&wid=1800&hei=800",
          alt: "Dell Pro Plus Earbuds",
          width: 1800,
          height: 800,
        },
        metrics: '{"btnname":"supercategory|lefttile1|Shop Now"}',
      },
      {
        id: "tile-4",
        badge: "Dell Pro Thunderbolt 5 Smart Dock – SD25TB5",
        title: "Next-level power delivery",
        description: "The world's first Thunderbolt 5 smart dock delivers up to 300W of power.",
        ctaText: "View Product Details",
        ctaLink: "https://www.dell.com/en-us/shop/dell-pro-thunderbolt-5-smart-dock-sd25tb5/apd/210-BRQS/docks",
        image: {
          src: "//i.dell.com/is/image/DellContent/content/dam/documents-and-videos/dv2/pan-dell/en/product-launch/peripherals/docks-and-stands/sd25tb5-dell-pro-thunderbolt-smart-dock/site-banners/2601g0080-gl-bb-site-dell-pro-5-smart-dock-sd25tb5-personalized-products-1800x800.png?qlt=95&fit=constrain,1&hei=800&wid=1800&fmt=png-alpha",
          alt: "Dell Pro Thunderbolt 5 Smart Dock – SD25TB5",
          width: 1800,
          height: 800,
        },
        metrics: '{"btnname":"supercategory|lefttile2|View Product Details"}',
        technote: {
          rel: "technotes:Dell-Pro-Thunderbolt-5-Smart-Dock",
          role: "button",
          text: "*",
        },
      },
      {
        id: "tile-5",
        badge: "Dell Pro Plus Wireless Speakerphone",
        title: "Crystal-Clear Calls, Anywhere",
        description: "Combine portability, versatile connectivity, and AI-enabled audio for distraction-free audio.",
        ctaText: "Shop Now",
        ctaLink: "https://www.dell.com/en-us/shop/dell-sl525-speakerphone/apd/520-BBMV/audio",
        image: {
          src: "//i.dell.com/is/image/DellContent/content/dam/documents-and-videos/dv2/pan-dell/en/product-launch/peripherals/speakerphones/sl525-wireless-speakerphone/site-banners/2601g0080-gl-cs-co-dell-pro-plus-sl525-wireless-speakerphone-site-1800x800.png?fmt=png-alpha&wid=1800&hei=800",
          alt: "Crystal-Clear Calls, Anywhere",
          width: 1800,
          height: 800,
        },
        metrics: '{"btnname":"supercategory|lefttile3|Shop Now"}',
      },
    ],
  },
];

export const merchandizingThreeCardsData: MerchandizingTile[] = [
  {
    id: "threecards-1",
    title: "Home Electronics",
    description: "From gaming consoles to smart home devices, get the best-selling electronics for your home.",
    ctaText: "Shop Home Electronics",
    ctaLink: "https://www.dell.com/en-us/shop/electronics",
    image: {
      src: "https://i.dell.com/is/image/DellContent/content/dam/ss2/page-specific/dell-com-landing-page/hero/na/home-electronics-update-ps5-blue.png",
      alt: "Home Electronics",
      width: 1180,
      height: 780,
    },
    metrics: '{"btnname":"supercategory|shopothercategory|shop1"}',
  },
  {
    id: "threecards-2",
    title: "Monitors",
    description: "Shop award-winning monitors with LED, touch screen, OLED, 4K & 6K resolution, and more.",
    ctaText: "Shop Monitors",
    ctaLink: "https://www.dell.com/en-us/shop/all-monitors/sac/monitors/all-monitors",
    image: {
      src: "//i.dell.com/is/image/DellContent/content/dam/ss2/product-images/page/category/pc-accessories/prod-992700-pc-accessories-content-image-1180x780-3.png?fmt=png-alpha&wid=1180&hei=780",
      alt: "Dell Monitor PC Accessories Category",
      width: 1180,
      height: 780,
    },
    metrics: '{"btnname":"supercategory|shopothercategory|shop2"}',
  },
  {
    id: "threecards-3",
    title: "Parts, Batteries, & Upgrades",
    description: "Find compatible parts and upgrades for your device.",
    ctaText: "Find Parts, Batteries, & Upgrades",
    ctaLink: "https://www.dell.com/en-us/shop/partsforyourdell",
    image: {
      src: "//i.dell.com/is/image/DellContent/content/dam/ss2/product-images/page/category/pc-accessories/prod-992700-pc-accessories-content-image-1180x780-2.png?fmt=png-alpha&wid=1180&hei=780",
      alt: "Dell Memory PC Accessories Category",
      width: 1180,
      height: 780,
    },
    metrics: '{"btnname":"supercategory|shopothercategory|shop3"}',
  },
];

export const merchandizingTwoTilesData: MerchandizingTile[] = [
  {
    id: "twotiles-1",
    title: "McAfee Store at Dell",
    description: "Online protection made simple.",
    ctaText: "Shop McAfee Products",
    ctaLink: "https://www.dell.com/en-us/lp/mcafee-store-at-dell",
    image: {
      src: "https://i.dell.com/is/image/DellContent/content/dam/ss2/page-specific/product-details-page/mcafee-pc-accessories-partner-module.png",
      alt: "McAfee Store at Dell",
      width: 1200,
      height: 750,
    },
    metrics: '{"btnname":"supercategory|shopthirdparty|shop1"}',
  },
  {
    id: "twotiles-2",
    title: "Xerox Color Printers?",
    description: "The answer is black and white.",
    ctaText: "Shop Xerox Products",
    ctaLink: "https://www.dell.com/en-us/lp/xerox",
    image: {
      src: "//i.dell.com/is/image/DellContent/content/dam/ss2/page-specific/category-pages/xerox-a4-dell-c410-lifestyle-1200x750.png?fmt=png-alpha&wid=2400&hei=1500",
      alt: "Xerox Color Printers?",
      width: 1200,
      height: 750,
    },
    metrics: '{"btnname":"supercategory|shopthirdparty|shop2"}',
  },
];

export const merchandizingThreeTilesData: MerchandizingTile[] = [
  {
    id: "threetiles-1",
    title: "Free shipping and easy returns",
    description: "Enjoy free shipping and no hassle returns.",
    ctaText: "View Dell's return policy",
    ctaLink: "https://www.dell.com/en-us/lp/return-policy#Return-Policy-and-FAQs",
    image: {
      src: "//i.dell.com/is/image/DellContent/content/dam/ss2/product-images/page/category/pc-accessories/pan-dell-bulk-unpacking-2585-1190x680.jpg?fmt=png-alpha&wid=1190&hei=680",
      alt: "PAN Dell Bulk Lifestyle Shoot Portrait",
      width: 1190,
      height: 680,
    },
    metrics: '{"btnname":"supercategory|benefits|shop1"}',
    technote: {
      rel: "technotes:superacc-freeshipping",
      role: "button",
      text: "*",
    },
  },
  {
    id: "threetiles-2",
    title: "Save with Dell Rewards",
    description: "Join Dell Rewards for free and earn up to 9% back in rewards to use toward future Dell.com purchases.",
    ctaText: "Learn about Dell Rewards",
    ctaLink: "https://www.dell.com/en-us/lp/dell-rewards",
    image: {
      src: "//i.dell.com/is/image/DellContent/content/dam/ss2/product-images/page/category/pc-accessories/pan-dell-bulk-lr-gaming-dog-dg5510nt-aw920h-1190x680.jpg?fmt=png-alpha&wid=1190&hei=680",
      alt: "PAN Dell Bulk Lifestyle Shoot Home Setting",
      width: 1190,
      height: 680,
    },
    metrics: '{"btnname":"supercategory|benefits|shop2"}',
  },
  {
    id: "threetiles-3",
    title: "Special financing offers",
    description: "Everyday financing offers with Dell Pay Credit. The easy way to get the tech you want.",
    ctaText: "Explore financing offers",
    ctaLink: "https://www.dell.com/en-us/lp/dell-financing-details",
    image: {
      src: "//i.dell.com/is/image/DellContent/content/dam/ss2/product-images/page/category/pc-accessories/pan-dell-bulk-off-learning-la9430t-wl5022-c2422he-km7321w-1190x680.jpg?fmt=png-alpha&wid=1190&hei=680",
      alt: "PAN Dell Bulk Lifestyle Shoot Office Setting",
      width: 1190,
      height: 680,
    },
    metrics: '{"btnname":"supercategory|benefits|shop3"}',
    technote: {
      rel: "technotes:superacc-financingoffer",
      role: "button",
      text: "*",
    },
  },
];
