import { initials } from "@nexo/shared";

const PALETTE = [
  "bg-[#DCE9F7] text-[#0062C4]",
  "bg-[#F6E3D3] text-[#9A4A12]",
  "bg-[#E6E1F7] text-[#5B3FC4]",
  "bg-[#DDF0E6] text-[#1E7A4C]",
  "bg-[#F7E1E6] text-[#A3324F]",
  "bg-[#FBEFD0] text-[#8A6100]",
];

const colorFor = (seed: string) => PALETTE[[...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % PALETTE.length];

export function Avatar({ id, name, size = 46 }: { id: string; name: string; size?: number }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: size / 3 }}
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${colorFor(id)}`}
    >
      {initials(name)}
    </span>
  );
}
