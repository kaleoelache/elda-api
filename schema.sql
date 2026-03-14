-- ============================================================
-- Elda Bolos e Doces — Schema PostgreSQL (Supabase)
-- ============================================================

-- Extensão para UUIDs
create extension if not exists "uuid-ossp";

-- ============================================================
-- CLIENTES
-- ============================================================
create table if not exists clientes (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade,
  email       text not null,
  nome        text not null,
  telefone    text,
  endereco    text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create unique index if not exists clientes_user_id_idx on clientes(user_id);
create unique index if not exists clientes_email_idx on clientes(email);

-- RLS
alter table clientes enable row level security;
create policy "Cliente vê próprio perfil" on clientes
  for select using (auth.uid() = user_id);
create policy "Cliente edita próprio perfil" on clientes
  for update using (auth.uid() = user_id);
create policy "Admin acessa tudo" on clientes
  for all using (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- PRODUTOS
-- ============================================================
create table if not exists produtos (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null,
  descricao   text,
  preco       numeric(10,2) not null check (preco >= 0),
  categoria   text,
  disponivel  boolean default true,
  imagem_url  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- RLS — produtos são públicos para leitura
alter table produtos enable row level security;
create policy "Qualquer um pode ver produtos" on produtos
  for select using (true);
create policy "Admin gerencia produtos" on produtos
  for all using (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- PEDIDOS
-- ============================================================
create table if not exists pedidos (
  id              uuid primary key default uuid_generate_v4(),
  cliente_id      uuid not null references clientes(id) on delete restrict,
  status          text not null default 'pendente'
                  check (status in ('pendente','confirmado','em_producao','pronto','entregue','cancelado')),
  total           numeric(10,2) not null check (total >= 0),
  data_entrega    date,
  observacoes     text,
  endereco_entrega text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table pedidos enable row level security;
create policy "Cliente vê próprios pedidos" on pedidos
  for select using (
    cliente_id in (select id from clientes where user_id = auth.uid())
  );
create policy "Cliente cria pedidos" on pedidos
  for insert with check (
    cliente_id in (select id from clientes where user_id = auth.uid())
  );
create policy "Admin gerencia pedidos" on pedidos
  for all using (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- ITENS DO PEDIDO
-- ============================================================
create table if not exists itens_pedido (
  id              uuid primary key default uuid_generate_v4(),
  pedido_id       uuid not null references pedidos(id) on delete cascade,
  produto_id      uuid not null references produtos(id) on delete restrict,
  quantidade      int not null check (quantidade > 0),
  preco_unitario  numeric(10,2) not null,
  subtotal        numeric(10,2) not null,
  created_at      timestamptz default now()
);

alter table itens_pedido enable row level security;
create policy "Acesso via pedido" on itens_pedido
  for select using (
    pedido_id in (
      select id from pedidos where cliente_id in (
        select id from clientes where user_id = auth.uid()
      )
    )
  );
create policy "Admin gerencia itens" on itens_pedido
  for all using (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- INGREDIENTES
-- ============================================================
create table if not exists ingredientes (
  id                  uuid primary key default uuid_generate_v4(),
  nome                text not null,
  unidade             text not null,
  quantidade_estoque  numeric(10,3) default 0,
  estoque_minimo      numeric(10,3) default 0,
  preco_unitario      numeric(10,2),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Ingredientes são privados (apenas admin)
alter table ingredientes enable row level security;
create policy "Admin gerencia ingredientes" on ingredientes
  for all using (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- PAGAMENTOS
-- ============================================================
create table if not exists pagamentos (
  id              uuid primary key default uuid_generate_v4(),
  pedido_id       uuid not null references pedidos(id) on delete restrict,
  mp_payment_id   text,
  metodo          text not null check (metodo in ('pix', 'cartao')),
  status          text not null default 'pending',
  valor           numeric(10,2) not null,
  parcelas        int default 1,
  qr_code         text,
  qr_code_base64  text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table pagamentos enable row level security;
create policy "Cliente vê próprios pagamentos" on pagamentos
  for select using (
    pedido_id in (
      select id from pedidos where cliente_id in (
        select id from clientes where user_id = auth.uid()
      )
    )
  );
create policy "Admin gerencia pagamentos" on pagamentos
  for all using (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- FUNÇÃO: atualiza updated_at automaticamente
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_clientes_updated_at
  before update on clientes for each row execute function set_updated_at();
create trigger trg_produtos_updated_at
  before update on produtos for each row execute function set_updated_at();
create trigger trg_pedidos_updated_at
  before update on pedidos for each row execute function set_updated_at();
create trigger trg_ingredientes_updated_at
  before update on ingredientes for each row execute function set_updated_at();
create trigger trg_pagamentos_updated_at
  before update on pagamentos for each row execute function set_updated_at();
