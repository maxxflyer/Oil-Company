"use client";

import React, { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bars3Icon, BookOpenIcon, BugAntIcon, Cog6ToothIcon, FireIcon, HomeIcon } from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick } from "~~/hooks/scaffold-eth";
import { useIsRegistryOwner } from "~~/hooks/useIsRegistryOwner";

type HeaderMenuLink = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

export const menuLinks: HeaderMenuLink[] = [
  {
    label: "Home",
    href: "/",
    icon: <HomeIcon className="h-4 w-4" />,
  },
  {
    label: "Pools",
    href: "/pools",
    icon: <FireIcon className="h-4 w-4" />,
  },
  {
    label: "Types",
    href: "/types",
    icon: <BookOpenIcon className="h-4 w-4" />,
  },
];

/** Le voci che si aprono solo per chi possiede il registro. */
const ownerMenuLinks: HeaderMenuLink[] = [
  {
    label: "Debug Contracts",
    href: "/debug",
    icon: <BugAntIcon className="h-4 w-4" />,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: <Cog6ToothIcon className="h-4 w-4" />,
  },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();
  const { isOwner } = useIsRegistryOwner();
  const links = isOwner ? [...menuLinks, ...ownerMenuLinks] : menuLinks;

  return (
    <>
      {links.map(({ label, href, icon }) => {
        const isActive = pathname === href;
        return (
          <li key={href} className="h-full">
            <Link
              href={href}
              passHref
              className={`${
                isActive ? "bg-base-300 text-primary neon-text" : ""
              } hover:bg-base-300 hover:text-primary focus:!bg-base-300 h-full px-4 text-sm gap-2 flex items-center whitespace-nowrap uppercase tracking-widest transition-colors`}
            >
              {icon}
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </>
  );
};

/**
 * Site header
 */
export const Header = () => {
  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <div className="sticky lg:static top-0 navbar bg-base-100/90 backdrop-blur min-h-16 shrink-0 justify-between z-20 border-b border-primary/40 p-0 sm:px-2 shadow-[0_1px_20px_-6px_var(--color-primary)]">
      <div className="navbar-start w-auto self-stretch">
        <details className="dropdown" ref={burgerMenuRef}>
          <summary className="ml-1 btn btn-ghost lg:hidden hover:bg-transparent">
            <Bars3Icon className="h-1/2" />
          </summary>
          <ul
            className="menu menu-compact dropdown-content mt-3 p-2 shadow-lg bg-base-100 w-52"
            onClick={() => {
              burgerMenuRef?.current?.removeAttribute("open");
            }}
          >
            <HeaderMenuLinks />
          </ul>
        </details>
        <Link href="/" passHref className="hidden lg:flex items-center gap-2 ml-4 mr-6 shrink-0">
          <div className="flex relative w-10 h-10">
            <Image alt="Oil Company" className="cursor-pointer" fill src="/logo.svg" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold leading-tight uppercase tracking-widest text-primary neon-text">
              Oil Company
            </span>
            <span className="tag-line">crude · onchain</span>
          </div>
        </Link>
        <ul className="hidden lg:flex lg:flex-nowrap h-full m-0 p-0 list-none">
          <HeaderMenuLinks />
        </ul>
      </div>
      <div className="navbar-end w-auto ml-auto shrink-0 mr-4 flex items-center gap-2">
        <RainbowKitCustomConnectButton />
      </div>
    </div>
  );
};
