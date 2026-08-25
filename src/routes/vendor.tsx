import { createFileRoute } from "@tanstack/react-router";
import { VendorHome } from "@/components/vendor-home";

export const Route = createFileRoute("/vendor")({ component: VendorHome });
