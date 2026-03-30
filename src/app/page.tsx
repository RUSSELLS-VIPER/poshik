/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Baloo_2, Manrope } from "next/font/google";
import {
  ArrowRight,
  Bone,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CirclePlay,
  Clock3,
  ClipboardCheck,
  Mail,
  MapPin,
  PawPrint,
  Phone,
  Sparkles,
  Star,
  Syringe,
  UserRound,
} from "lucide-react";
import { connectDB } from "@/lib/db/mongodb";
import Appointment from "@/lib/db/models/Appointment";
import Order from "@/lib/db/models/Order";
import Pet from "@/lib/db/models/Pet";
import Product from "@/lib/db/models/Product";
import User from "@/lib/db/models/User";

export const dynamic = "force-dynamic";

const headingFont = Baloo_2({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const bodyFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

type Person = {
  id: string;
  name: string;
  bio: string;
  phone: string;
  email: string;
  role: string;
};

type ProductItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  imageUrl: string;
  createdAt: Date | null;
};

type PetItem = {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: number | null;
  imageUrl: string;
  createdAt: Date | null;
};

type AppointmentItem = {
  id: string;
  date: string;
  time: string;
  status: string;
  notes: string;
  createdAt: Date | null;
};

type OrderItem = {
  id: string;
  total: number;
  status: string;
  itemCount: number;
  createdAt: Date | null;
};

type LandingData = {
  stats: {
    totalUsers: number;
    activeUsers: number;
    ownerCount: number;
    doctorCount: number;
    shopCount: number;
    petCount: number;
    activeProductCount: number;
    orderCount: number;
    appointmentsPipeline: number;
    ordersToday: number;
  };
  doctors: Person[];
  owners: Person[];
  products: ProductItem[];
  pets: PetItem[];
  appointments: AppointmentItem[];
  orders: OrderItem[];
  serviceCategories: string[];
};

type GalleryCell = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
};

const numberFormatter = new Intl.NumberFormat("en-IN");
const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function formatDate(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) {
    return "No date";
  }

  return dateFormatter.format(value);
}

function toStatusLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveImageSrc(imageUrl: string, fallback: string) {
  if (!imageUrl) return fallback;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  if (imageUrl.startsWith("/")) return imageUrl;
  if (imageUrl.startsWith("uploads/")) return `/${imageUrl}`;
  return fallback;
}

function truncateText(text: string, maxLength: number) {
  const value = text.trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

function fallbackBio(name: string, role: string, stats: LandingData["stats"]) {
  if (role === "DOCTOR") {
    return `${name} supports ${formatCount(stats.petCount)} pet profiles with practical consultation guidance.`;
  }
  return `${name} is part of our community of ${formatCount(stats.ownerCount)} owners sharing active care journeys.`;
}

async function getLandingData(): Promise<LandingData> {
  const fallback: LandingData = {
    stats: {
      totalUsers: 0,
      activeUsers: 0,
      ownerCount: 0,
      doctorCount: 0,
      shopCount: 0,
      petCount: 0,
      activeProductCount: 0,
      orderCount: 0,
      appointmentsPipeline: 0,
      ordersToday: 0,
    },
    doctors: [],
    owners: [],
    products: [],
    pets: [],
    appointments: [],
    orders: [],
    serviceCategories: [],
  };

  try {
    await connectDB();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      ownerCount,
      doctorCount,
      shopCount,
      petCount,
      activeProductCount,
      orderCount,
      appointmentsPipeline,
      ordersToday,
      doctorsRaw,
      ownersRaw,
      productsRaw,
      petsRaw,
      appointmentsRaw,
      ordersRaw,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: "OWNER" }),
      User.countDocuments({ role: "DOCTOR" }),
      User.countDocuments({ role: "SHOP" }),
      Pet.countDocuments({}),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments({}),
      Appointment.countDocuments({ status: { $in: ["BOOKED", "CONFIRMED"] } }),
      Order.countDocuments({ createdAt: { $gte: startOfToday } }),
      User.find({ role: "DOCTOR", isActive: true })
        .select("_id name bio phone email role")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      User.find({ role: "OWNER", isActive: true })
        .select("_id name bio phone email role")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      Product.find({ isActive: true })
        .select("_id name description price category stock imageUrl createdAt")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Pet.find({ isPublic: true })
        .select("_id name type breed age imageUrl createdAt")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Appointment.find({})
        .select("_id date time status notes createdAt")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      Order.find({})
        .select("_id total status items createdAt")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
    ]);

    const doctors: Person[] = doctorsRaw.map((doctor: any) => ({
      id: String(doctor._id),
      name: String(doctor.name || "Unnamed doctor"),
      bio: String(doctor.bio || ""),
      phone: String(doctor.phone || ""),
      email: String(doctor.email || ""),
      role: String(doctor.role || "DOCTOR"),
    }));

    const owners: Person[] = ownersRaw.map((owner: any) => ({
      id: String(owner._id),
      name: String(owner.name || "Unnamed owner"),
      bio: String(owner.bio || ""),
      phone: String(owner.phone || ""),
      email: String(owner.email || ""),
      role: String(owner.role || "OWNER"),
    }));

    const products: ProductItem[] = productsRaw.map((product: any) => ({
      id: String(product._id),
      name: String(product.name || "Untitled service"),
      description: String(product.description || ""),
      price: Number(product.price || 0),
      category: String(product.category || "GENERAL"),
      stock: Number(product.stock || 0),
      imageUrl: String(product.imageUrl || ""),
      createdAt: product.createdAt ? new Date(product.createdAt) : null,
    }));

    const pets: PetItem[] = petsRaw.map((pet: any) => ({
      id: String(pet._id),
      name: String(pet.name || "Unnamed pet"),
      type: String(pet.type || "Pet"),
      breed: String(pet.breed || "Unknown breed"),
      age: typeof pet.age === "number" ? pet.age : null,
      imageUrl: String(pet.imageUrl || ""),
      createdAt: pet.createdAt ? new Date(pet.createdAt) : null,
    }));

    const appointments: AppointmentItem[] = appointmentsRaw.map(
      (appointment: any) => ({
        id: String(appointment._id),
        date: String(appointment.date || "No date"),
        time: String(appointment.time || "No time"),
        status: String(appointment.status || "BOOKED"),
        notes: String(appointment.notes || ""),
        createdAt: appointment.createdAt ? new Date(appointment.createdAt) : null,
      })
    );

    const orders: OrderItem[] = ordersRaw.map((order: any) => ({
      id: String(order._id),
      total: Number(order.total || 0),
      status: String(order.status || "PENDING"),
      itemCount: Array.isArray(order.items) ? order.items.length : 0,
      createdAt: order.createdAt ? new Date(order.createdAt) : null,
    }));

    const serviceCategories = Array.from(
      new Set(
        products
          .map((product) => product.category.trim())
          .filter((category) => category.length > 0)
      )
    ).slice(0, 3);

    return {
      stats: {
        totalUsers,
        activeUsers,
        ownerCount,
        doctorCount,
        shopCount,
        petCount,
        activeProductCount,
        orderCount,
        appointmentsPipeline,
        ordersToday,
      },
      doctors,
      owners,
      products,
      pets,
      appointments,
      orders,
      serviceCategories,
    };
  } catch (error) {
    console.error("Landing page data fetch failed:", error);
    return fallback;
  }
}

export default async function Home() {
  const data = await getLandingData();
  const heroImage =
    resolveImageSrc(data.pets[0]?.imageUrl || "", "/images/default-pet.png");
  const aboutMainImage =
    resolveImageSrc(data.pets[1]?.imageUrl || "", "/images/default-pet.png");
  const aboutSecondaryImage =
    resolveImageSrc(data.pets[2]?.imageUrl || "", "/images/default-pet.png");
  const avatarNames = [...data.owners, ...data.doctors].slice(0, 3);
  const services = data.products.slice(0, 3);
  const serviceHighlights = data.products.slice(0, 2);
  const teamMembers = data.doctors.slice(0, 4);
  const teamLead = data.doctors[0];
  const stepAppointments = data.appointments.slice(0, 3);
  const recentOrders = data.orders.slice(0, 3);
  const testimonialPeople = [...data.owners, ...data.doctors].slice(0, 2);

  const galleryCells: GalleryCell[] = data.pets.slice(0, 6).map((pet) => ({
    id: pet.id,
    title: pet.name,
    subtitle: `${pet.type} · ${pet.breed}`,
    image: resolveImageSrc(pet.imageUrl, "/images/default-pet.png"),
  }));

  const faqItems = [
    {
      question: "How many active specialists can owners reach right now?",
      answer: `${formatCount(
        data.stats.doctorCount
      )} doctor profiles are currently active and visible across the platform.`,
    },
    {
      question: "How much activity is moving through the platform today?",
      answer: `${formatCount(
        data.stats.ordersToday
      )} orders were created today, while ${formatCount(
        data.stats.appointmentsPipeline
      )} appointments are in the active booking pipeline.`,
    },
    {
      question: "How large is the current owner and pet community?",
      answer: `${formatCount(data.stats.ownerCount)} owners are managing ${formatCount(
        data.stats.petCount
      )} pet profiles in the system.`,
    },
    {
      question: "What service catalog is currently available?",
      answer: `${formatCount(
        data.stats.activeProductCount
      )} active services and products are listed by ${formatCount(
        data.stats.shopCount
      )} shop accounts.`,
    },
  ];

  const articleCards = [
    ...data.products.slice(0, 2).map((product) => ({
      id: `product-${product.id}`,
      image: resolveImageSrc(product.imageUrl, "/images/default-pet.png"),
      label: product.category,
      title: truncateText(product.name, 54),
      excerpt: truncateText(
        product.description ||
          `${product.name} is currently available for bookings and orders on the platform.`,
        92
      ),
      date: formatDate(product.createdAt),
      href: `/shop/products/${product.id}`,
    })),
    ...data.pets.slice(0, 1).map((pet) => ({
      id: `pet-${pet.id}`,
      image: resolveImageSrc(pet.imageUrl, "/images/default-pet.png"),
      label: pet.type,
      title: truncateText(`${pet.name}: care profile updates`, 54),
      excerpt: truncateText(
        `New updates in ${pet.name}'s profile for breed ${pet.breed} and daily care tracking.`,
        92
      ),
      date: formatDate(pet.createdAt),
      href: "/owner/pets",
    })),
  ];

  return (
    <div className={`${bodyFont.className} pet-light-pattern text-[#0d1124]`}>
      <section className="relative overflow-hidden rounded-[2rem] bg-[#121423] px-6 py-10 text-white sm:px-10 sm:py-14">
        <img
          src={heroImage}
          alt="Hero pet"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
        <div className="hero-image-overlay absolute inset-0" />
        <div className="relative z-10 max-w-2xl">
          <span className="pet-badge">Petcare Intelligence Hub</span>
          <h1 className={`${headingFont.className} mt-4 text-4xl leading-tight sm:text-6xl`}>
            The Best Pets
            <br />
            <span className="text-[#ff7a1a]">Meet</span> Treat
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/85 sm:text-2xl sm:leading-9">
            Join Poshik, the first all-in-one platform where pet owners meet, shops thrive, and veterinarians provide world-class care. From local playdates to instant medical bookings—everything your pet needs is just a paw-tap away.
          </p>
        </div>
        <div className="relative z-10 mt-16 grid gap-4 rounded-[1.4rem] bg-black/70 p-5 backdrop-blur lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex -space-x-2">
              {avatarNames.length > 0 ? (
                avatarNames.map((person) => (
                  <span
                    key={person.id}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-[#1d2138] text-sm font-bold text-white"
                    title={person.name}
                  >
                    {person.name.slice(0, 1).toUpperCase()}
                  </span>
                ))
              ) : (
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-[#1d2138] text-sm font-bold text-white">
                  P
                </span>
              )}
            </div>
            <p className="text-sm text-white/80">
              <strong className="text-white">{formatCount(data.stats.activeUsers)}</strong>{" "}
              active members and{" "}
              <strong className="text-white">{formatCount(data.stats.petCount)}</strong>{" "}
              tracked pets.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 text-center text-xs sm:grid-cols-3 sm:gap-6 sm:text-sm">
            <div>
              <p className="text-2xl font-extrabold text-[#ff7a1a]">
                {formatCount(data.stats.petCount)}+
              </p>
              <p className="text-white/80">Pampered Pets</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[#ff7a1a]">
                {formatCount(data.stats.doctorCount)}+
              </p>
              <p className="text-white/80">Team Members</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[#ff7a1a]">
                {formatCount(data.stats.orderCount)}+
              </p>
              <p className="text-white/80">Service Orders</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <div>
          <span className="pet-badge">Our Story</span>
          <h2 className={`${headingFont.className} mt-3 text-4xl leading-tight sm:text-6xl`}>
            We are fully committed to your pet&apos;s well-being
          </h2>
          <p className="mt-5 max-w-xl text-base text-[#5f6475] sm:text-lg">
            Poshik brings owners, doctors, and stores into a single flow so pet
            care decisions, purchases, and appointments stay connected.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-[#ff7a1a]" />
              Skilled personnel: {formatCount(data.stats.doctorCount)}
            </p>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-[#ff7a1a]" />
              Active community: {formatCount(data.stats.ownerCount)}
            </p>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-[#ff7a1a]" />
              Product listings: {formatCount(data.stats.activeProductCount)}
            </p>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-[#ff7a1a]" />
              Bookings in pipeline: {formatCount(data.stats.appointmentsPipeline)}
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="grid gap-4 sm:grid-cols-[1.25fr_0.95fr]">
            <img
              src={aboutMainImage}
              alt="Main story visual"
              className="h-72 w-full rounded-[1.4rem] object-cover sm:h-96"
            />
            <img
              src={aboutSecondaryImage}
              alt="Secondary story visual"
              className="h-72 w-full rounded-[1.4rem] object-cover sm:h-96"
            />
          </div>
          <div className="absolute right-4 top-4 hidden rounded-[1.2rem] bg-[#ff7a1a] px-5 py-4 text-white sm:block">
            <p className="text-4xl font-black">
              {formatCount(data.stats.petCount)}+
            </p>
            <p className="text-sm font-semibold">Happy Paws</p>
          </div>
        </div>
      </section>

      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="pet-badge">Our Services</span>
            <h2 className={`${headingFont.className} mt-3 text-4xl sm:text-6xl`}>
              We Have Wide Range Of Pet Products
            </h2>
          </div>
          <Link
            href="/shop/products"
            className="inline-flex items-center rounded-full border border-[#b7bccd] px-7 py-3 text-sm font-semibold transition hover:border-[#ff7a1a] hover:text-[#ff7a1a]"
          >
            Browse All Products
          </Link>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {services.length > 0 ? (
            services.map((product) => (
              <article
                key={product.id}
                className="group overflow-hidden rounded-[1.8rem] bg-[#0f1222] text-white"
              >
                <img
                  src={resolveImageSrc(product.imageUrl, "/images/default-pet.png")}
                  alt={product.name}
                  className="h-72 w-full object-cover opacity-75 transition duration-500 group-hover:scale-105"
                />
                <div className="space-y-2 px-6 py-5">
                  <p className="text-xs uppercase tracking-wide text-[#ffb782]">
                    {product.category}
                  </p>
                  <h3 className={`${headingFont.className} text-3xl`}>{product.name}</h3>
                  <p className="text-sm text-white/85">
                    {truncateText(
                      product.description ||
                        `${product.name} is currently listed with real-time availability.`,
                      96
                    )}
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xl font-bold text-[#ff7a1a]">
                      {formatMoney(product.price)}
                    </p>
                    <Link
                      href={`/shop/products/${product.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-white hover:text-[#ffb782]"
                    >
                      View
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.6rem] border border-[#dbd7d2] bg-[#efede9] px-6 py-10 text-sm text-[#5b6072] lg:col-span-3">
              No active service records found in the database yet.
            </div>
          )}
        </div>
      </section>

      <section className="pet-dark-pattern mt-16 overflow-hidden rounded-[2rem] bg-[#070a13] px-6 py-12 text-white sm:px-10">
        <div className="text-center">
          <span className="pet-badge">Recent Stories</span>
          <h2 className={`${headingFont.className} mt-3 text-4xl sm:text-6xl`}>
            Our Success Stories
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/70 sm:text-base">
            A living gallery of profiles added and updated by your community.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {galleryCells.length > 0 ? (
            galleryCells.map((cell, index) => (
              <article
                key={cell.id}
                className={`overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#101525] ${
                  index === 0 ? "md:col-span-2 md:row-span-2" : ""
                }`}
              >
                <img
                  src={cell.image}
                  alt={cell.title}
                  className={`w-full object-cover ${
                    index === 0 ? "h-[260px] sm:h-[320px] lg:h-[380px]" : "h-[180px]"
                  }`}
                />
                <div className="px-4 py-3">
                  <p className="text-sm font-bold">{cell.title}</p>
                  <p className="text-xs text-white/70">{cell.subtitle}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.2rem] border border-white/20 bg-white/10 px-5 py-8 text-sm text-white/80 md:col-span-4">
              No public pet stories found in the database.
            </div>
          )}
        </div>
      </section>

      <section className="mt-16">
        <div className="text-center">
          <span className="pet-badge">Service Highlights</span>
          <h2 className={`${headingFont.className} mt-3 text-4xl sm:text-6xl`}>
            Loyal Hearts, Forever Homes.
          </h2>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          {serviceHighlights[0] ? (
            <article className="grid gap-4 rounded-[1.6rem] bg-[#e9e6e2] p-5">
              <img
                src={resolveImageSrc(
                  serviceHighlights[0].imageUrl,
                  "/images/default-pet.png"
                )}
                alt={serviceHighlights[0].name}
                className="h-72 w-full rounded-[1.2rem] object-cover"
              />
              <h3 className={`${headingFont.className} text-4xl`}>
                {serviceHighlights[0].name}
              </h3>
              <p className="text-2xl font-extrabold text-[#11162e]">
                {formatMoney(serviceHighlights[0].price)}
              </p>
              <p className="text-sm text-[#5f6475]">
                {truncateText(
                  serviceHighlights[0].description ||
                    `${serviceHighlights[0].name} has live stock visibility and active bookings.`,
                  140
                )}
              </p>
              <Link
                href={`/shop/products/${serviceHighlights[0].id}`}
                className="inline-flex w-fit items-center rounded-full bg-violet-500 px-6 py-3 text-sm font-bold text-white hover:bg-violet-600"
              >
                Enquire Now
              </Link>
            </article>
          ) : (
            <div className="rounded-[1.4rem] border border-[#dbd7d2] bg-[#efede9] px-6 py-10 text-sm text-[#5b6072]">
              No featured service available yet.
            </div>
          )}

          <div className="space-y-4">
            {serviceHighlights[1] ? (
              <article className="rounded-[1.6rem] bg-[#e9e6e2] p-5">
                <div className="grid gap-4 sm:grid-cols-[130px_1fr]">
                  <img
                    src={resolveImageSrc(
                      serviceHighlights[1].imageUrl,
                      "/images/default-pet.png"
                    )}
                    alt={serviceHighlights[1].name}
                    className="h-44 w-full rounded-xl object-cover sm:h-28"
                  />
                  <div>
                    <h3 className={`${headingFont.className} text-3xl`}>
                      {serviceHighlights[1].name}
                    </h3>
                    <p className="mt-1 text-xl font-extrabold">
                      {formatMoney(serviceHighlights[1].price)}
                    </p>
                    <p className="mt-2 text-sm text-[#5f6475]">
                      {truncateText(
                        serviceHighlights[1].description ||
                          `${serviceHighlights[1].name} is available with active pricing data.`,
                        96
                      )}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/shop/products/${serviceHighlights[1].id}`}
                  className="mt-4 inline-flex items-center rounded-full bg-violet-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-600"
                >
                  Enquire Now
                </Link>
              </article>
            ) : (
              <div className="rounded-[1.4rem] border border-[#dbd7d2] bg-[#efede9] px-6 py-8 text-sm text-[#5b6072]">
                No secondary highlight record found.
              </div>
            )}

            <article className="rounded-[1.6rem] bg-[#ece9e4] p-5">
              <h3 className={`${headingFont.className} text-3xl`}>
                Platform Order Pulse
              </h3>
              <div className="mt-4 space-y-3">
                {recentOrders.length > 0 ? (
                  recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl bg-white px-4 py-3 text-sm"
                    >
                      <p className="font-bold text-[#151a33]">
                        {formatMoney(order.total)} · {order.itemCount} items
                      </p>
                      <p className="text-xs font-semibold text-[#5f6475]">
                        {toStatusLabel(order.status)} · {formatDate(order.createdAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#5f6475]">
                    No recent orders available.
                  </p>
                )}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="pet-dark-pattern mt-16 rounded-[2rem] bg-[#070a13] px-6 py-12 text-white sm:px-10">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div>
            <span className="pet-badge">Quick Answers</span>
            <h2 className={`${headingFont.className} mt-3 text-4xl sm:text-6xl`}>
              Frequently Ask Questions
            </h2>
            <div className="mt-7 space-y-3">
              {faqItems.map((faq, index) => (
                <details
                  key={faq.question}
                  open={index === 0}
                  className="rounded-xl bg-white text-[#11162e]"
                >
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold sm:text-base">
                    {index + 1}. {faq.question}
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-7 text-[#5f6475]">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
          <img
            src={resolveImageSrc(data.pets[6]?.imageUrl || "", "/images/PET_FAQ.webp")}
            alt="FAQ visual"
            className="h-full min-h-[280px] w-full rounded-[1.4rem] object-cover sm:min-h-[420px]"
          />
        </div>
      </section>
      <section className="mt-16 overflow-hidden rounded-[2rem] border border-[#dfd9d1] bg-[#f2efea]">
       

        <div className="border-t border-[#dfd9d1] bg-[#171922] px-6 py-10 text-white sm:px-10">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#ff7a1a] text-white">
                  <Bone className="h-5 w-5" />
                </span>
                <p className={`${headingFont.className} text-4xl`}>Poshik</p>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-7 text-white/75">
                Poshik is a connected pet ecosystem where owners, doctors and
                shops coordinate better care with real operational visibility.
              </p>
              <div className="mt-4 space-y-2 text-sm text-white/75">
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#ff7a1a]" />
                  support@poshik.app
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#ff7a1a]" />
                  Platform linked with active users in your live database
                </p>
              </div>
            </div>

            <div>
              <h3 className={`${headingFont.className} text-3xl`}>Quick Links</h3>
              <ul className="mt-3 space-y-2 text-sm text-white/75">
                <li>
                  <Link href="/" className="hover:text-[#ff7a1a]">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/profile" className="hover:text-[#ff7a1a]">
                    Profile
                  </Link>
                </li>
                <li>
                  <Link href="/discover" className="hover:text-[#ff7a1a]">
                    Discover
                  </Link>
                </li>
                <li>
                  <Link href="/shop" className="hover:text-[#ff7a1a]">
                    Shop
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className={`${headingFont.className} text-3xl`}>Live Stats</h3>
              <ul className="mt-3 space-y-2 text-sm text-white/75">
                <li className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-[#ff7a1a]" />
                  Appointments: {formatCount(data.stats.appointmentsPipeline)}
                </li>
                <li className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-[#ff7a1a]" />
                  Orders: {formatCount(data.stats.orderCount)}
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#ff7a1a]" />
                  Active users: {formatCount(data.stats.activeUsers)}
                </li>
              </ul>
            </div>

            <div>
              <h3 className={`${headingFont.className} text-3xl`}>Support</h3>
              <ul className="mt-3 space-y-2 text-sm text-white/75">
                <li>
                  <Link href="/login" className="hover:text-[#ff7a1a]">
                    Login
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-[#ff7a1a]">
                    Register
                  </Link>
                </li>
                <li>
                  <Link href="/doctor" className="hover:text-[#ff7a1a]">
                    Doctor
                  </Link>
                </li>
                <li>
                  <Link href="/owner/appointments" className="hover:text-[#ff7a1a]">
                    Bookings
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-sm text-white/60">
            <p>
              Copyright {new Date().getFullYear()} Poshik. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20">
                <UserRound className="h-4 w-4" />
              </span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20">
                <PawPrint className="h-4 w-4" />
              </span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20">
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
