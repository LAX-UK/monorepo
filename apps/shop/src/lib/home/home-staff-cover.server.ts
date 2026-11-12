import { readStaffCover } from "@/lib/home/home-staff-cover";
import { fetchPublicHomeCover } from "@/lib/shop-api.server";

/** The staff-chosen cover over the shop-api public read. */
export const loadStaffCover = () => readStaffCover(fetchPublicHomeCover);
