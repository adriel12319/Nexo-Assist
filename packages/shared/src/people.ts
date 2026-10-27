export type Role = "employee" | "analyst";

export interface Person {
  id: string;
  name: string;
  email: string;
  department: string;
  role: Role;
}

export const PEOPLE: readonly Person[] = [
  { id: "u-ana", name: "Ana Souza", email: "ana.souza@nexo.com.br", department: "Financeiro", role: "employee" },
  { id: "u-bruno", name: "Bruno Tavares", email: "bruno.tavares@nexo.com.br", department: "Comercial", role: "employee" },
  { id: "u-carla", name: "Carla Mendes", email: "carla.mendes@nexo.com.br", department: "RH", role: "employee" },
  { id: "u-diego", name: "Diego Ramos", email: "diego.ramos@nexo.com.br", department: "Marketing", role: "employee" },
  { id: "u-rafael", name: "Rafael Lima", email: "rafael.lima@nexo.com.br", department: "Suporte N2", role: "analyst" },
  { id: "u-juliana", name: "Juliana Costa", email: "juliana.costa@nexo.com.br", department: "Suporte N1", role: "analyst" },
];

export const findPersonByEmail = (email: string) =>
  PEOPLE.find((person) => person.email === email.trim().toLowerCase());

export const findPerson = (id: string) => PEOPLE.find((person) => person.id === id);

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
