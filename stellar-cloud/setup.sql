begin;

create schema if not exists stellar_private;
revoke all on schema stellar_private from public, anon, authenticated;

create table stellar_private.classrooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null check (char_length(name) between 1 and 60),
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  created_at timestamptz not null default now()
);

create table stellar_private.members (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references stellar_private.classrooms(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  row_no integer check (row_no between 1 and 6),
  col_no integer check (col_no between 1 and 6),
  star_name text check (char_length(star_name) between 1 and 40),
  initial_mass numeric check (initial_mass between 0.01 and 60),
  final_mass numeric check (final_mass between 0.01 and 60),
  ending text,
  epitaph text check (char_length(epitaph) <= 80),
  completed_at timestamptz,
  partner_id uuid references stellar_private.members(id),
  unique (classroom_id, user_id),
  unique (classroom_id, row_no, col_no),
  check ((row_no is null) = (col_no is null)),
  check (partner_id is null or partner_id <> id)
);

alter table stellar_private.classrooms enable row level security;
alter table stellar_private.members enable row level security;
revoke all on all tables in schema stellar_private from public, anon, authenticated;

create function public.stellar_classroom(action text, payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  classroom stellar_private.classrooms%rowtype;
  student stellar_private.members%rowtype;
  partner stellar_private.members%rowtype;
  wanted_row integer;
  wanted_col integer;
  birth_mass numeric;
  ending_mass numeric;
  display_name text;
  room_name text;
  result jsonb;
begin
  if caller is null then
    raise exception '请先登录';
  end if;

  if action = 'create' then
    if coalesce((auth.jwt()->>'is_anonymous')::boolean, true)
       or coalesce(auth.jwt()->>'email', '') = '' then
      raise exception '创建课堂需要教师邮箱登录';
    end if;
    room_name := btrim(payload->>'name');
    if room_name is null or char_length(room_name) not between 1 and 60 then
      raise exception '课堂名称需要1至60个字';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));
    if (select count(*) from stellar_private.classrooms where owner_id = caller) >= 20 then
      raise exception '最多保留20个课堂，请先删除旧课堂';
    end if;
    insert into stellar_private.classrooms(owner_id, name)
      values (caller, room_name) returning * into classroom;
    return jsonb_build_object('id', classroom.id, 'name', classroom.name, 'code', classroom.code);
  end if;

  if action = 'list' then
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'code', code)
      order by created_at desc), '[]'::jsonb) into result
      from stellar_private.classrooms where owner_id = caller;
    return result;
  end if;

  if action = 'join' then
    select * into classroom from stellar_private.classrooms
      where code = upper(btrim(payload->>'code')) for update;
  else
    select * into classroom from stellar_private.classrooms
      where id = (payload->>'classroom_id')::uuid for update;
  end if;
  if classroom.id is null then
    raise exception '课堂不存在或课堂码不正确';
  end if;

  select * into student from stellar_private.members
    where classroom_id = classroom.id and user_id = caller;

  if action = 'join' then
    if student.id is null and classroom.owner_id <> caller then
      if (select count(*) from stellar_private.members where classroom_id = classroom.id) >= 36 then
        raise exception '本星区已满36人';
      end if;
      insert into stellar_private.members(classroom_id, user_id)
        values(classroom.id, caller) returning * into student;
    end if;
  elsif classroom.owner_id <> caller and student.id is null then
    raise exception '你尚未加入这个课堂';
  end if;

  if action = 'delete' then
    if classroom.owner_id <> caller then raise exception '只有教师可以删除课堂'; end if;
    delete from stellar_private.classrooms where id = classroom.id;
    return jsonb_build_object('deleted', true);
  end if;

  if action = 'claim' then
    if student.id is null then raise exception '教师预览不占用学生位置'; end if;
    wanted_row := (payload->>'row')::integer;
    wanted_col := (payload->>'col')::integer;
    birth_mass := (payload->>'initial_mass')::numeric;
    display_name := btrim(payload->>'star_name');
    if wanted_row is null or wanted_col is null or wanted_row not between 1 and 6 or wanted_col not between 1 and 6 then
      raise exception '请选择6×6网格内的位置';
    end if;
    if birth_mass is null or birth_mass not between 0.01 and 60
       or display_name is null or char_length(display_name) not between 1 and 40 then
      raise exception '恒星名称或初始质量不合法';
    end if;
    if student.row_no is not null then
      if student.row_no <> wanted_row or student.col_no <> wanted_col then
        raise exception '位置已锁定，不能更换';
      end if;
    else
      if exists(select 1 from stellar_private.members where classroom_id = classroom.id
          and row_no = wanted_row and col_no = wanted_col) then
        raise exception '这个位置刚被其他同学选走，请重新选择';
      end if;
      update stellar_private.members set row_no = wanted_row, col_no = wanted_col,
        initial_mass = birth_mass, star_name = display_name
        where id = student.id returning * into student;
    end if;
  end if;

  if action = 'finish' then
    if student.id is null or student.row_no is null then raise exception '请先栽种恒星'; end if;
    if student.completed_at is null then
      ending_mass := (payload->>'final_mass')::numeric;
      if ending_mass is null or ending_mass not between 0.01 and 60 then
        raise exception '最终质量不合法';
      end if;
      if char_length(coalesce(payload->>'epitaph', '')) > 80 then
        raise exception '寄语最多80个字';
      end if;
      update stellar_private.members set final_mass = ending_mass,
        ending = case when ending_mass < 0.08 then '褐矮星'
          when ending_mass <= 8 then '白矮星' when ending_mass <= 20 then '中子星' else '黑洞' end,
        epitaph = coalesce(payload->>'epitaph', ''), completed_at = clock_timestamp()
        where id = student.id returning * into student;
      if student.initial_mass between 1 and 8 then
        select * into partner from stellar_private.members
          where classroom_id = classroom.id and id <> student.id
          and initial_mass between 1 and 8 and completed_at is not null and partner_id is null
          and abs(row_no - student.row_no) + abs(col_no - student.col_no) = 1
          order by completed_at, row_no, col_no, id limit 1;
        if partner.id is not null then
          update stellar_private.members set partner_id = partner.id where id = student.id;
          update stellar_private.members set partner_id = student.id where id = partner.id;
        end if;
      end if;
    end if;
  end if;

  if action not in ('join', 'claim', 'finish', 'snapshot') then
    raise exception '未知操作';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'row', row_no, 'col', col_no, 'star_name', star_name,
      'initial_mass', initial_mass, 'final_mass', final_mass, 'ending', ending,
      'epitaph', epitaph, 'completed_at', completed_at, 'partner_id', partner_id
    ) order by row_no, col_no), '[]'::jsonb) into result
    from stellar_private.members where classroom_id = classroom.id and row_no is not null;
  return jsonb_build_object('id', classroom.id, 'name', classroom.name,
    'code', classroom.code, 'is_teacher', classroom.owner_id = caller,
    'self_id', student.id, 'stars', result);
end;
$$;

revoke all on function public.stellar_classroom(text, jsonb) from public, anon;
grant execute on function public.stellar_classroom(text, jsonb) to authenticated;

commit;
