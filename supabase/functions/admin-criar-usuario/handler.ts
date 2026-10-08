type NovoUsuario = { nome: string; email: string; senha: string };
type UsuarioCriado = { id: string; email: string };

export class EmailJaCadastradoError extends Error {}

export interface DependenciasCriacaoUsuario {
  autenticar(autorizacao: string): Promise<string | null>;
  ehAdmin(userId: string): Promise<boolean>;
  criarUsuario(input: NovoUsuario): Promise<UsuarioCriado>;
  registrarAuditoria(
    actorId: string,
    user: UsuarioCriado,
    nome: string,
  ): Promise<void>;
  avisar?(mensagem: string): void;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function validarCorpo(valor: unknown): NovoUsuario | null {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
    return null;
  }

  const corpo = valor as Record<string, unknown>;
  if (
    typeof corpo.nome !== "string" || typeof corpo.email !== "string" ||
    typeof corpo.senha !== "string"
  ) {
    return null;
  }

  const nome = corpo.nome.trim();
  const email = corpo.email.trim().toLowerCase();
  const tamanhoNome = [...nome].length;

  if (tamanhoNome < 2 || tamanhoNome > 60) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  if (corpo.senha.length < 6) return null;

  return { nome, email, senha: corpo.senha };
}

export function criarHandlerAdminCriarUsuario(
  deps: DependenciasCriacaoUsuario,
) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") {
      return responder({ erro: "método não permitido" }, 405);
    }

    const autorizacao = req.headers.get("Authorization") ?? "";
    if (autorizacao === "") return responder({ erro: "não autenticado" }, 401);

    let actorId: string | null;
    try {
      actorId = await deps.autenticar(autorizacao);
    } catch {
      return responder({ erro: "não autenticado" }, 401);
    }
    if (actorId === null) return responder({ erro: "não autenticado" }, 401);

    let ehAdmin: boolean;
    try {
      ehAdmin = await deps.ehAdmin(actorId);
    } catch {
      return responder({
        erro: "não foi possível verificar a permissão administrativa",
      }, 500);
    }
    if (!ehAdmin) {
      return responder(
        { erro: "somente administrador pode criar usuários" },
        403,
      );
    }

    let valor: unknown;
    try {
      valor = await req.json();
    } catch {
      return responder({ erro: "corpo inválido" }, 400);
    }

    const corpo = validarCorpo(valor);
    if (corpo === null) {
      return responder(
        {
          erro:
            "informe nome (2 a 60 caracteres), e-mail válido e senha de ao menos 6 caracteres",
        },
        400,
      );
    }

    let criado: UsuarioCriado;
    try {
      criado = await deps.criarUsuario(corpo);
    } catch (error) {
      if (error instanceof EmailJaCadastradoError) {
        return responder({ erro: "este e-mail já está cadastrado" }, 409);
      }
      return responder({ erro: "não foi possível criar a conta" }, 500);
    }

    try {
      await deps.registrarAuditoria(actorId, criado, corpo.nome);
    } catch {
      // A conta Auth já existe. Nunca apague a conta nem induza uma repetição.
      deps.avisar?.("Falha ao registrar auditoria de criação de conta.");
      return responder({
        id: criado.id,
        email: criado.email,
        nome: corpo.nome,
        avisoAuditoria:
          "A conta foi criada, mas o registro na auditoria falhou. Não tente criar a conta novamente; informe o administrador.",
      }, 201);
    }

    return responder(
      { id: criado.id, email: criado.email, nome: corpo.nome },
      201,
    );
  };
}
