import { auth } from "@/lib/auth";
import prisma from "@/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if user has owner membership in any salon
    const ownerMembership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        role: "OWNER",
      },
      include: {
        salon: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!ownerMembership) {
      return new Response(
        JSON.stringify({ error: "Owner privileges required" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        salon: ownerMembership.salon,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error verifying owner status:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
