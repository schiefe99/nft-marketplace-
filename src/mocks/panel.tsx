import { FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { Cart } from '@/contracts'
import type { ScenarioName } from './scenarios'

/**
 * Painel de demonstração: seleciona cenários do MSW, restaura os dados e
 * dispara eventos pelo servidor Socket.IO simulado. Não altera estado da UI
 * diretamente — tudo passa pelos handlers MSW e pelo socket.io-client.
 */
export default function MockPanel() {
  const controls = window.__mocks!
  const qc = useQueryClient()
  const [active, setActive] = useState<ScenarioName[]>(controls.getScenarios())
  const [busy, setBusy] = useState(false)

  const toggle = (name: ScenarioName, on: boolean) => {
    const next = on ? [...active.filter((n) => n !== 'default'), name] : active.filter((n) => n !== name)
    const final: ScenarioName[] = next.length ? next : ['default']
    controls.setScenario(final)
    setActive(final)
  }

  const reset = async () => {
    setBusy(true)
    await controls.reset(active)
    window.location.assign('/')
  }

  const bumpCartPrice = () => {
    const cart = qc.getQueriesData<Cart>({ queryKey: ['cart'] }).map(([, c]) => c).find((c) => c?.items.length)
    const item = cart?.items[0]
    if (item) controls.updateNft(item.nftId, { editionId: item.editionId, priceFactor: '1.15' })
  }

  const soldOutCart = () => {
    const cart = qc.getQueriesData<Cart>({ queryKey: ['cart'] }).map(([, c]) => c).find((c) => c?.items.length)
    const item = cart?.items[0]
    if (item) controls.updateNft(item.nftId, { editionId: item.editionId, available: 0 })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="fixed bottom-20 left-3 z-40 flex items-center gap-2 rounded-full border border-border-soft bg-surface-2 px-3 py-2 text-xs font-bold text-accent shadow-lg md:bottom-4"
          aria-label="Abrir painel de mocks"
        >
          <FlaskConical className="size-4" aria-hidden="true" /> Mocks
        </button>
      </DialogTrigger>
      <DialogContent side="left" className="w-[min(380px,100%)]">
        <DialogTitle className="text-xl">Cenários simulados (MSW)</DialogTitle>
        <DialogDescription>Combine cenários de rede e de negócio. Ficam salvos até o reset.</DialogDescription>
        <fieldset className="mt-5 flex flex-col gap-3">
          <legend className="sr-only">Cenários</legend>
          {controls.scenarios.map((s) => (
            <label key={s.name} className="flex cursor-pointer items-start gap-3 text-sm">
              <Checkbox checked={active.includes(s.name)} onCheckedChange={(v) => toggle(s.name, v === true)} className="mt-0.5" />
              <span>
                <span className="font-bold">{s.name}</span>
                <span className="block text-xs text-muted">{s.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="mt-6 flex flex-col gap-2 border-t border-border pt-5">
          <p className="text-sm font-bold">Eventos Socket.IO</p>
          <Button variant="outline" size="sm" onClick={bumpCartPrice}>Subir preço do 1º item do carrinho (+15%)</Button>
          <Button variant="outline" size="sm" onClick={soldOutCart}>Esgotar 1º item do carrinho</Button>
          <Button variant="outline" size="sm" onClick={() => controls.dropSockets()}>Derrubar conexão em tempo real</Button>
        </div>
        <div className="mt-6 border-t border-border pt-5">
          <Button variant="danger" size="md" className="w-full" onClick={reset} disabled={busy}>
            Restaurar dados e cenário
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
