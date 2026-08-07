import type { ReactNode } from "react";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { hasKindeConfig } from "@/lib/kinde";

type KindeAuthValue = ReturnType<typeof useKindeAuth>;

export function KindeAuthGate({
  children,
  fallback = null,
}: {
  children: (auth: KindeAuthValue) => ReactNode;
  fallback?: ReactNode;
}) {
  if (!hasKindeConfig()) {
    return <>{fallback}</>;
  }

  return <KindeAuthContent>{children}</KindeAuthContent>;
}

function KindeAuthContent({ children }: { children: (auth: KindeAuthValue) => ReactNode }) {
  const auth = useKindeAuth();
  return <>{children(auth)}</>;
}
