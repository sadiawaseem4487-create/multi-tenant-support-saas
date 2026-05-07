type Props = {
  brandName: string;
};

const categories = [
  {
    title: "Electronics",
    description: "Phones, laptops, accessories, and smart home essentials.",
    abbr: "E",
  },
  {
    title: "Fashion",
    description: "Clothing, footwear, and seasonal collections for every style.",
    abbr: "F",
  },
  {
    title: "Home essentials",
    description: "Furniture, décor, kitchenware, and everyday living.",
    abbr: "H",
  },
  {
    title: "Beauty & wellness",
    description: "Skincare, cosmetics, and self-care favorites.",
    abbr: "B",
  },
];

export function CompanyMarketing({ brandName }: Props) {
  return (
    <div className="space-y-12 pb-12 lg:pb-16">
      <section className="rounded-3xl bg-white/80 px-6 py-10 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/80 backdrop-blur-sm sm:px-10 sm:py-14">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
          Welcome
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
          Shop smarter with {brandName}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
          {brandName} is your online destination for quality products, fair prices, and
          support you can trust. Browse our categories, discover new arrivals, and get
          answers anytime from our assistant on the right.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#products"
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 transition hover:from-teal-500 hover:to-cyan-600"
          >
            Explore products
          </a>
          <a
            href="#why-us"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/50"
          >
            Why shop with us
          </a>
        </div>
      </section>

      <section id="products" className="scroll-mt-24">
        <h2 className="text-2xl font-bold text-slate-900">Our product categories</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Everything you need in one place. Tap a category to start browsing on your
          storefront when you connect your catalog.
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {categories.map((c) => (
            <li
              key={c.title}
              className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm ring-1 ring-slate-100 transition hover:border-teal-200 hover:shadow-md"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-100 to-sky-100 text-sm font-bold text-teal-800"
                aria-hidden
              >
                {c.abbr}
              </span>
              <h3 className="mt-3 font-semibold text-slate-900">{c.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{c.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="why-us" className="scroll-mt-24">
        <h2 className="text-2xl font-bold text-slate-900">Why customers choose us</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Secure checkout",
              body: "Encrypted payments and trusted payment partners at checkout.",
            },
            {
              title: "Reliable delivery",
              body: "Standard and express options so you get orders when you need them.",
            },
            {
              title: "Fair returns",
              body: "Clear return windows and support if something is not right.",
            },
          ].map((item) => (
            <li
              key={item.title}
              className="rounded-2xl bg-gradient-to-b from-teal-50/80 to-white p-5 ring-1 ring-teal-100/80"
            >
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/80 px-6 py-8">
        <h2 className="text-lg font-semibold text-slate-900">Need human help?</h2>
        <p className="mt-2 text-sm text-slate-600">
          Our assistant answers from your official guides. You can also reach the team
          through your usual support channels listed in your knowledge base.
        </p>
      </section>

      <footer className="border-t border-slate-200 pt-8 text-center text-xs text-slate-500">
        <p>
          © {new Date().getFullYear()} {brandName}. Demo storefront layout with embedded
          support chat.
        </p>
      </footer>
    </div>
  );
}
