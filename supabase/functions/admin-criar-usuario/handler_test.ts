import {
  criarHandlerAdminCriarUsuario,
  type DependenciasCriacaoUsuario,
  EmailJaCadastradoError,
} from "./handler.ts";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";

function dependencias(overrides: Partial<DependenciasCriacaoUsuario> = {}) {
  const criados: Array<{ nome: string; email: string; senha: string }> = [];
  const avisos: string[] = [];
  const deps: DependenciasCriacaoUsuario = {
    autenticar: async () => ADMIN_ID,
    ehAdmin: async () => true,
    criarUsuario: async (input) => {
      criados.push(input);
      return { id: USER_ID, email: input.email };
    },
    registrarAuditoria: async () => {},
    avisar: (mensagem) => avisos.push(mensagem),
    ...overrides,
  };
  return { deps, criados, avisos };
}

function requisicao(body?: string, authorization = "Bearer teste") {
  return new Request("http://localhost/admin-criar-usuario", {
    method: "POST",
    headers: authorization === ""
      ? {}
      : { Authorization: authorization, "Content-Type": "application/json" },
    body,
  });
}

Deno.test("rejeita chamadas sem autenticação antes de consultar permissões", async () => {
  let consultouAdmin = false;
  const { deps } = dependencias({
    ehAdmin: async () => {
      consultouAdmin = true;
      return true;
    },
  });
  const resposta = await criarHandlerAdminCriarUsuario(deps)(
    requisicao("{", ""),
  );
  if (resposta.status !== 401 || consultouAdmin) {
    throw new Error("auth gate não foi preservado");
  }
});

Deno.test("preserva 401 para token inválido e 403 para usuário autenticado sem papel admin", async () => {
  const invalido = dependencias({ autenticar: async () => null });
  const resposta401 = await criarHandlerAdminCriarUsuario(invalido.deps)(
    requisicao("{}"),
  );
  const comum = dependencias({ ehAdmin: async () => false });
  const resposta403 = await criarHandlerAdminCriarUsuario(comum.deps)(
    requisicao("{}"),
  );
  if (resposta401.status !== 401 || resposta403.status !== 403) {
    throw new Error("status de auth/admin incorreto");
  }
});

Deno.test("JSON inválido recebe 400 sem tentar criar conta", async () => {
  const { deps, criados } = dependencias();
  const resposta = await criarHandlerAdminCriarUsuario(deps)(requisicao("{"));
  if (resposta.status !== 400 || criados.length !== 0) {
    throw new Error("JSON inválido não foi rejeitado");
  }
});

Deno.test("valida objeto e tipos antes de normalizar campos", async () => {
  const corpos = [
    "null",
    "[]",
    '"texto"',
    '{"nome":17,"email":"pessoa@example.com","senha":"123456"}',
    '{"nome":"Pessoa","email":null,"senha":"123456"}',
    '{"nome":"Pessoa","email":"pessoa@example.com","senha":123456}',
  ];
  for (const corpo of corpos) {
    const { deps, criados } = dependencias();
    const resposta = await criarHandlerAdminCriarUsuario(deps)(
      requisicao(corpo),
    );
    if (resposta.status !== 400 || criados.length !== 0) {
      throw new Error(`corpo inválido aceito: ${corpo}`);
    }
  }
});

Deno.test("valida nome de acordo com o CHECK do banco e os demais campos", async () => {
  const corpos = [
    { nome: " A ", email: "pessoa@example.com", senha: "123456" },
    { nome: "x".repeat(61), email: "pessoa@example.com", senha: "123456" },
    { nome: "Pessoa", email: "sem-arroba", senha: "123456" },
    { nome: "Pessoa", email: "pessoa@example.com", senha: "12345" },
  ];
  for (const corpo of corpos) {
    const { deps } = dependencias();
    const resposta = await criarHandlerAdminCriarUsuario(deps)(
      requisicao(JSON.stringify(corpo)),
    );
    if (resposta.status !== 400) {
      throw new Error("campo fora do contrato foi aceito");
    }
  }
});

Deno.test("normaliza nome/e-mail e cria uma conta com resposta 201", async () => {
  const { deps, criados } = dependencias();
  const resposta = await criarHandlerAdminCriarUsuario(deps)(
    requisicao(JSON.stringify({
      nome: "  Pessoa Teste  ",
      email: " Pessoa@Example.com ",
      senha: "123456",
    })),
  );
  const corpo = await resposta.json();
  if (
    resposta.status !== 201 || corpo.email !== "pessoa@example.com" ||
    corpo.nome !== "Pessoa Teste"
  ) {
    throw new Error("resposta de criação incorreta");
  }
  if (criados.length !== 1 || criados[0].senha !== "123456") {
    throw new Error("criação não foi chamada uma vez");
  }
});

Deno.test("falha de criação não expõe erro interno; e-mail existente mantém 409", async () => {
  const falha = dependencias({
    criarUsuario: async () => {
      throw new Error("detalhe interno");
    },
  });
  const resposta500 = await criarHandlerAdminCriarUsuario(falha.deps)(
    requisicao(JSON.stringify({
      nome: "Pessoa",
      email: "pessoa@example.com",
      senha: "123456",
    })),
  );
  const corpo500 = await resposta500.text();
  const duplicado = dependencias({
    criarUsuario: async () => {
      throw new EmailJaCadastradoError();
    },
  });
  const resposta409 = await criarHandlerAdminCriarUsuario(duplicado.deps)(
    requisicao(JSON.stringify({
      nome: "Pessoa",
      email: "pessoa@example.com",
      senha: "123456",
    })),
  );
  if (
    resposta500.status !== 500 || corpo500.includes("detalhe interno") ||
    resposta409.status !== 409
  ) {
    throw new Error("falhas de criação não foram sanitizadas/preservadas");
  }
});

Deno.test("falha de auditoria preserva conta criada, emite warning e orienta não repetir", async () => {
  const { deps, criados, avisos } = dependencias({
    registrarAuditoria: async () => {
      throw new Error("erro interno do banco");
    },
  });
  const resposta = await criarHandlerAdminCriarUsuario(deps)(
    requisicao(JSON.stringify({
      nome: "Pessoa",
      email: "pessoa@example.com",
      senha: "123456",
    })),
  );
  const corpo = await resposta.json();
  if (
    resposta.status !== 201 || corpo.id !== USER_ID || criados.length !== 1 ||
    avisos.length !== 1
  ) {
    throw new Error("falha de auditoria removeu ou repetiu a conta");
  }
  if (!corpo.avisoAuditoria?.includes("Não tente criar a conta novamente")) {
    throw new Error("resposta não orienta a pessoa a não repetir");
  }
});

Deno.test("falha ao consultar papel não vaza mensagem do banco", async () => {
  const { deps } = dependencias({
    ehAdmin: async () => {
      throw new Error("sql secreto");
    },
  });
  const resposta = await criarHandlerAdminCriarUsuario(deps)(requisicao("{}"));
  const corpo = await resposta.text();
  if (resposta.status !== 500 || corpo.includes("sql secreto")) {
    throw new Error("erro interno exposto");
  }
});
