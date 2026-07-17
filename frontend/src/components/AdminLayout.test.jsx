import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithMantine, screen } from '../test-utils'
import AdminLayout from './AdminLayout'

describe('AdminLayout', () => {
  it('renders the title and children', () => {
    renderWithMantine(
      <AdminLayout>
        <div>content</div>
      </AdminLayout>,
    )

    expect(screen.getByText('App')).toBeInTheDocument()
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('toggles the color scheme', async () => {
    const user = userEvent.setup()

    renderWithMantine(
      <AdminLayout>
        <div>content</div>
      </AdminLayout>,
    )

    const toggle = screen.getByRole('button', { name: 'Toggle color scheme' })
    await user.click(toggle)

    expect(toggle).toBeInTheDocument()
  })
})
