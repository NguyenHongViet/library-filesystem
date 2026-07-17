import { Button, Tooltip } from '@mantine/core'
import { IconLock, IconWorld } from '@tabler/icons-react'

function SharingToggle({ isPublic, onToggle, loading = false }) {
  return (
    <Tooltip label={isPublic ? 'Make private' : 'Make public'} withArrow>
      <Button
        variant="light"
        size="compact-xs"
        color={isPublic ? 'green' : 'gray'}
        loading={loading}
        leftSection={isPublic ? <IconWorld size={14} /> : <IconLock size={14} />}
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
      >
        {isPublic ? 'Public' : 'Private'}
      </Button>
    </Tooltip>
  )
}

export default SharingToggle
