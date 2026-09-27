import { redirect } from "next/navigation";

export default async function ExceptionAliasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/situations/${id}`);
}
