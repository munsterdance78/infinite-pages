module.exports = async () => {
  // Global test cleanup
  console.log('🧹 Cleaning up test environment...')

  // Clean up any global mocks or test data
  delete global.mockSupabaseData

  console.log('✅ Test cleanup complete')
}