import { describe, it, expect } from 'vitest'
import { adminIds, isAdminId, ADMIN_SWITCH_PLANS } from './admins.ts'

describe('admin accounts', () => {
  it('reads the comma-separated list and ignores blanks', () => {
    expect(adminIds(' a , b,, ')).toEqual(['a', 'b'])
    expect(adminIds(undefined)).toEqual([])
  })
  it('accepts only listed ids', () => {
    expect(isAdminId('b', 'a,b')).toBe(true)
    expect(isAdminId('c', 'a,b')).toBe(false)
    expect(isAdminId('', 'a,b')).toBe(false)
    expect(isAdminId('a', '')).toBe(false)
  })
  it('lets an admin go to any plan of the grid and back to launch', () => {
    expect(ADMIN_SWITCH_PLANS).toEqual(['launch', 'free', 'starter', 'pro', 'team_groups', 'team_work'])
  })
})
