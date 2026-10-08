import { notFound } from "next/navigation";
import { MockGateway } from "@/components/order/mock-gateway";
import { getProviderById } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { formatFils } from "@/lib/ordering/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Test payment", robots: { index: false } };

/** Stand-in for a hosted gateway page. Only exists when PAYMENT_PROVIDER=mock outside production. */
export default async function MockPayPage({ params }: { params: Promise<{ token: string }> }) {
  if (!getProviderById("mock")) notFound();
  const { token } = await params;
  const order = await prisma.order.findUnique({
    where: { trackingToken: token },
    select: { number: true, totalFils: true, status: true },
  });
  if (!order) notFound();
  return <MockGateway token={token} number={order.number} amount={formatFils(order.totalFils)} pending={order.status === "PENDING_PAYMENT"} />;
}
