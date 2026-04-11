import { nanoid } from 'nanoid'

export function generateTaskId(): string {
  return `tsk_${nanoid(8)}`
}

export function generateActivityId(): string {
  return `act_${nanoid(8)}`
}

export function generateNotificationId(): string {
  return `ntf_${nanoid(8)}`
}

export function generateWorkspaceId(): string {
  return `ws_${nanoid(8)}`
}

export function generateAgentId(): string {
  return `agent_${nanoid(8)}`
}

export function generateId(): string {
  return nanoid(8)
}
