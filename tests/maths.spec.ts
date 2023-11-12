import { test } from '@japa/runner'

test.group('maths', () => {
  test('My Test', ({ assert }) => {
    assert.equal(1 + 1, 2)
  })
})
