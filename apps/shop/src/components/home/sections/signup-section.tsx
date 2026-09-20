import type { HomePageViewModel } from "@/lib/home/home-page.vm";
import Image from "next/image";
import Link from "next/link";

type SignupSectionProps = {
  signup: HomePageViewModel["signup"];
  cta?: { label: string; href: string } | null;
};

export function SignupSection({ signup, cta }: SignupSectionProps) {
  return (
    <section className="shop-home__signup" aria-labelledby="signup-heading">
      <div className="shop-home__signup-copy">
        <h2 id="signup-heading" className="shop-home__signup-title">
          {signup.title}
        </h2>
        <p className="shop-home__signup-text">{signup.copy}</p>
        {cta ? (
          <Link href={cta.href} className="shop-home__signup-button shop-focus-ring">
            {cta.label}
          </Link>
        ) : null}
      </div>
      <div className="shop-home__signup-media">
        <Image
          src={signup.image}
          alt={signup.imageAlt}
          fill
          sizes="(min-width: 960px) 872px, 100vw"
          className="shop-home__signup-photo"
        />
      </div>
    </section>
  );
}
