import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithMantine, screen } from '../test-utils'
import SharingToggle from './SharingToggle'

describe('SharingToggle', () => {
  it('shows Public with the world icon when public', () => {
    renderWithMantine(<SharingToggle isPublic onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Public' })).toBeInTheDocument()
  })

  it('shows Private when not public', () => {
    renderWithMantine(<SharingToggle isPublic={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Private' })).toBeInTheDocument()
  })

  it('calls onToggle and stops click propagation', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const onParentClick = vi.fn()

    renderWithMantine(
      <div onClick={onParentClick}>
        <SharingToggle isPublic={false} onToggle={onToggle} />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: 'Private' }))

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onParentClick).not.toHaveBeenCalled()
  })
})
