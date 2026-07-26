import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Trainer } from '../types'
import { RANKS } from '../types'
import {
  TRAINER_ATTRIBUTE_LABELS,
  SOCIAL_LABELS,
  TRAINER_SKILL_GROUPS,
} from '../constants'
import {
  rankAttributePoints,
  rankSocialPoints,
  rankSkillPoints,
  rankSkillLimit,
  ageAttributePoints,
  ageSocialPoints,
  AGES,
  AGE_LABELS,
} from '../lib/progression'
import Stepper from '../components/Stepper'
import SkillRoll from '../components/SkillRoll'
import Shop from '../components/Shop'
import ImagePicker, { DEFAULT_AVATAR } from '../components/ImagePicker'
import { useMesa } from '../lib/mesa'
import { useCustomItems, customItemToItem } from '../lib/customItems'

export const getActiveTrainerId = (): number | null => {
  const v = localStorage.getItem('activeTrainerId')
  return v ? Number(v) : null
}

const emptyTrainer = (): Trainer => ({
  name: '',
  rank: 'Starter',
  age: 'Teen', // padrão pra novos jogos (Corebook 3.0 p.41)
  // humanos não têm Special (Corebook 3.0 p. 34)
  attributes: { strength: 1, dexterity: 1, vitality: 1, special: 0, insight: 1 },
  social: { tough: 1, cool: 1, beauty: 1, cute: 1, clever: 1 },
  skills: {},
  hp: 5,
  currentHp: 5,
  notes: '',
  money: 0,
  inventory: [],
})

export default function TrainersPage() {
  const trainers = useLiveQuery(() => db.trainers.toArray(), []) ?? []
  const [editing, setEditing] = useState<Trainer | null>(null)
  const [activeId, setActiveId] = useState<number | null>(getActiveTrainerId())
  const [rollingId, setRollingId] = useState<number | null>(null)
  // itens customizados só existem se você estiver numa mesa (são
  // criados pelo Mestre lá) — fora de mesa a loja mostra só o catálogo
  const { activeMesa } = useMesa()
  const customItemRows = useCustomItems(activeMesa?.id ?? null)
  const customItems = customItemRows.map(customItemToItem)

  const trainerHp = editing ? 4 + editing.attributes.vitality : 0
  const willPoints = editing ? editing.attributes.insight + 3 : 0
  const age = editing?.age ?? 'Teen'

  // Pontos de Atributo/Social = Rank + Idade, somados no mesmo orçamento
  // livre pra distribuir (Corebook 3.0 p.30-31 e p.41). Humanos sempre
  // partem de 1 em cada Atributo/Social, sem variação por espécie.
  const attrBudget = editing ? rankAttributePoints(editing.rank) + ageAttributePoints(age) : 0
  const attrSpent = editing
    ? TRAINER_ATTRIBUTE_LABELS.reduce(
        (sum, { key }) => sum + Math.max(0, editing.attributes[key] - 1),
        0,
      )
    : 0
  const attrRemaining = Math.max(0, attrBudget - attrSpent)
  // Champion (p.31): Atributos podem passar do limite de 5 em até 2 pontos
  // — a exceção fala só de "Attribute Scores", não de Social.
  const attrCap = 5 + (editing?.rank === 'Champion' ? 2 : 0)
  const attrMax = (key: keyof Trainer['attributes']) =>
    editing ? Math.min(attrCap, editing.attributes[key] + attrRemaining) : attrCap

  const socialBudget = editing ? rankSocialPoints(editing.rank) + ageSocialPoints(age) : 0
  const socialSpent = editing
    ? SOCIAL_LABELS.reduce((sum, { key }) => sum + Math.max(0, editing.social[key] - 1), 0)
    : 0
  const socialRemaining = Math.max(0, socialBudget - socialSpent)
  const socialMax = (key: keyof Trainer['social']) =>
    editing ? Math.min(5, editing.social[key] + socialRemaining) : 5

  const skillBudget = editing ? rankSkillPoints(editing.rank) : 0
  const skillSpent = editing
    ? Object.values(editing.skills).reduce((sum, v) => sum + (v ?? 0), 0)
    : 0
  const skillRemaining = Math.max(0, skillBudget - skillSpent)
  const skillLimit = editing ? rankSkillLimit(editing.rank) : 5
  const skillMax = (skillName: string) => {
    if (!editing) return skillLimit
    const current = editing.skills[skillName] ?? 0
    return Math.min(skillLimit, current + skillRemaining)
  }

  const save = async () => {
    if (!editing || !editing.name.trim()) return
    const record = { ...editing, hp: trainerHp, currentHp: trainerHp }
    if (editing.id) await db.trainers.put(record)
    else await db.trainers.add(record)
    setEditing(null)
  }

  const remove = async (id: number) => {
    if (!confirm('Excluir este treinador? As fichas de Pokémon vinculadas continuam salvas.'))
      return
    await db.trainers.delete(id)
    if (activeId === id) {
      localStorage.removeItem('activeTrainerId')
      setActiveId(null)
    }
  }

  const setActive = (id: number) => {
    localStorage.setItem('activeTrainerId', String(id))
    setActiveId(id)
  }

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <h1 className="text-2xl font-bold text-slate-800">
          {editing.id ? `Editando ${editing.name}` : 'Novo Treinador'}
        </h1>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <ImagePicker
            value={editing.imageUrl}
            fallback={DEFAULT_AVATAR}
            onChange={(imageUrl) => setEditing({ ...editing, imageUrl })}
          />
        </div>

        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">
              Nome
            </span>
            <input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">
              Rank
            </span>
            <select
              value={editing.rank}
              onChange={(e) =>
                setEditing({ ...editing, rank: e.target.value as Trainer['rank'] })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            >
              {RANKS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">
              Idade
            </span>
            <select
              value={age}
              onChange={(e) =>
                setEditing({ ...editing, age: e.target.value as Trainer['age'] })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            >
              {AGES.map((a) => (
                <option key={a} value={a}>
                  {AGE_LABELS[a]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Afeta os pontos de Atributo/Social junto com o Rank (p.41).
            </p>
          </label>
          <div className="flex gap-4 text-sm text-slate-600 sm:col-span-2">
            <span>
              HP: <b className="text-slate-800">{trainerHp}</b>{' '}
              <span className="text-xs text-slate-400">(4 + Vitality)</span>
            </span>
            <span>
              Will Points: <b className="text-slate-800">{willPoints}</b>{' '}
              <span className="text-xs text-slate-400">(Insight + 3)</span>
            </span>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Atributos</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  attrRemaining > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
                title="Pontos ganhos por Rank + Idade (p.30-31 e p.41), livres pra distribuir"
              >
                {attrRemaining}/{attrBudget} pontos (Rank + Idade)
              </span>
            </div>
            <div className="space-y-2">
              {TRAINER_ATTRIBUTE_LABELS.map(({ key, label }) => (
                <Stepper
                  key={key}
                  label={label}
                  value={editing.attributes[key]}
                  min={1}
                  max={attrMax(key)}
                  dotMax={5}
                  onChange={(v) =>
                    setEditing({
                      ...editing,
                      attributes: { ...editing.attributes, [key]: v },
                    })
                  }
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Atributos Sociais</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  socialRemaining > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {socialRemaining}/{socialBudget} pontos (Rank + Idade)
              </span>
            </div>
            <div className="space-y-2">
              {SOCIAL_LABELS.map(({ key, label }) => (
                <Stepper
                  key={key}
                  label={label}
                  value={editing.social[key]}
                  min={1}
                  max={socialMax(key)}
                  dotMax={5}
                  onChange={(v) =>
                    setEditing({
                      ...editing,
                      social: { ...editing.social, [key]: v },
                    })
                  }
                />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Skills</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                skillRemaining > 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {skillRemaining}/{skillBudget} Skill Points · limite {skillLimit}/skill
            </span>
          </div>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {TRAINER_SKILL_GROUPS.map(({ group, skills }) => (
              <div key={group}>
                <h3 className="mb-2 text-xs font-bold text-slate-400 uppercase">
                  {group}
                </h3>
                <div className="space-y-1.5">
                  {skills.map((s) => (
                    <Stepper
                      key={s}
                      label={s}
                      value={editing.skills[s] ?? 0}
                      max={skillMax(s)}
                      dotMax={skillLimit}
                      onChange={(v) =>
                        setEditing({
                          ...editing,
                          skills: { ...editing.skills, [s]: v },
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold text-slate-800">💰 Economia</h2>
          <Shop
            money={editing.money ?? 0}
            inventory={editing.inventory ?? []}
            onChange={(money, inventory) =>
              setEditing({ ...editing, money, inventory })
            }
            customItems={customItems}
          />
          {activeMesa && (
            <p className="mt-2 text-xs text-slate-400">
              Itens 🛠️ são personalizados pelo Mestre da mesa "{activeMesa.name}".
            </p>
          )}
        </div>

        <label className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            Notas
          </span>
          <textarea
            value={editing.notes}
            onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
          />
        </label>

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={!editing.name.trim()}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-40"
          >
            Salvar
          </button>
          <button
            onClick={() => setEditing(null)}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Treinadores</h1>
        <button
          onClick={() => setEditing(emptyTrainer())}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
        >
          + Novo Treinador
        </button>
      </div>

      {trainers.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400 shadow-sm">
          Nenhum treinador ainda. Crie o primeiro!
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trainers.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border bg-white p-5 shadow-sm ${
                activeId === t.id ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <img
                  src={t.imageUrl || DEFAULT_AVATAR}
                  alt=""
                  className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                />
                <h2 className="flex-1 text-lg font-bold text-slate-800">{t.name}</h2>
                <button
                  onClick={() => setActive(t.id!)}
                  title="Definir como treinador ativo"
                  className={`text-xl ${activeId === t.id ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}
                >
                  ★
                </button>
              </div>
              <p className="text-sm text-slate-500">
                Rank {t.rank} · HP {t.hp} · Will {t.attributes.insight + 3} · 💰{' '}
                {t.money ?? 0}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Str {t.attributes.strength} · Dex {t.attributes.dexterity} · Vit{' '}
                {t.attributes.vitality} · Ins {t.attributes.insight}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setEditing(t)}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Editar
                </button>
                <button
                  onClick={() =>
                    setRollingId(rollingId === t.id ? null : t.id!)
                  }
                  className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                    rollingId === t.id
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  🎲 Rolar
                </button>
                <button
                  onClick={() => remove(t.id!)}
                  className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-500 hover:bg-red-50"
                >
                  Excluir
                </button>
              </div>
              {rollingId === t.id && (
                <div className="mt-3">
                  <SkillRoll sheet={t} displayName={t.name} isPokemon={false} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
