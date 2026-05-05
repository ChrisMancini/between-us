"use client";

import { createContext, useContext, useMemo } from "react";
import type { SerializedPerson, PersonPair } from "@/types/person";

interface PersonsContextValue {
  persons: PersonPair;
  personMap: Map<string, SerializedPerson>;
}

const PersonsContext = createContext<PersonsContextValue | null>(null);

export function PersonsProvider({
  persons,
  children,
}: {
  persons: PersonPair;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({
      persons,
      personMap: new Map(persons.map((p) => [p.key, p])),
    }),
    [persons]
  );

  return (
    <PersonsContext.Provider value={value}>{children}</PersonsContext.Provider>
  );
}

export function usePersons(): PersonsContextValue {
  const ctx = useContext(PersonsContext);
  if (!ctx) throw new Error("usePersons must be used within PersonsProvider");
  return ctx;
}
