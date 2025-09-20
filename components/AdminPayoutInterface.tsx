'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  DollarSign,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Calendar,
  RefreshCw
} from 'lucide-react'

interface PayoutBatch {
  id: string
  batch_date: string
  total_creators_paid: number
  total_amount_usd: number
  stripe_batch_id: string | null
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  individual_payouts?: IndividualPayout[]
}

interface IndividualPayout {
  id: string
  creator_id: string
  amount_usd: number
  stripe_transfer_id: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  created_at: string
  creator_email?: string
}

interface PayoutSummary {
  eligible_creators: number
  total_amount: number
  minimum_payout: number
  processing_date: string
  creators: Array<{
    creator_id: string
    email: string
    amount: number
    has_stripe_customer: boolean
  }>
}

export default function AdminPayoutInterface() {
  const [batches, setBatches] = useState<PayoutBatch[]>([])
  const [summary, setSummary] = useState<PayoutSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<PayoutBatch | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadPayoutBatches()
    loadPayoutPreview()
  }, [])

  const loadPayoutBatches = async () => {
    try {
      const response = await fetch('/api/admin/process-payouts')
      if (response.ok) {
        const data = await response.json()
        setBatches(data.recent_batches || [])
      }
    } catch (error) {
      console.error('Failed to load payout batches:', error)
    }
  }

  const loadPayoutPreview = async () => {
    try {
      const response = await fetch('/api/admin/process-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: true })
      })

      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      }
    } catch (error) {
      console.error('Failed to load payout preview:', error)
    }
  }

  const processPayouts = async (dryRun: boolean = false) => {
    setProcessing(true)
    try {
      const response = await fetch('/api/admin/process-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_date: new Date().toISOString().split('T')[0],
          dry_run: dryRun
        })
      })

      const data = await response.json()

      if (response.ok) {
        if (!dryRun) {
          await loadPayoutBatches()
          await loadPayoutPreview()
        }

        // Show result message
        alert(data.message || 'Payout processing completed')
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Payout processing failed:', error)
      alert('Payout processing failed')
    } finally {
      setProcessing(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-600" />
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString()

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Creator Payout Management</h1>
          <p className="text-gray-600 mt-1">Manage monthly creator payouts and transfers</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => loadPayoutPreview()}
            variant="outline"
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => setShowPreview(!showPreview)}
            variant="outline"
          >
            <Calendar className="w-4 h-4 mr-2" />
            {showPreview ? 'Hide' : 'Show'} Preview
          </Button>
        </div>
      </div>

      {/* Payout Preview */}
      {showPreview && summary && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800">This Month's Payout Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-white rounded border">
                <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-600">
                  {summary.eligible_creators}
                </div>
                <div className="text-sm text-gray-600">Eligible Creators</div>
              </div>

              <div className="text-center p-4 bg-white rounded border">
                <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.total_amount)}
                </div>
                <div className="text-sm text-gray-600">Total Amount</div>
              </div>

              <div className="text-center p-4 bg-white rounded border">
                <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(summary.minimum_payout)}
                </div>
                <div className="text-sm text-gray-600">Minimum Payout</div>
              </div>

              <div className="text-center p-4 bg-white rounded border">
                <Calendar className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-orange-600">
                  {formatDate(summary.processing_date)}
                </div>
                <div className="text-sm text-gray-600">Processing Date</div>
              </div>
            </div>

            <div className="flex justify-center space-x-4">
              <Button
                onClick={() => processPayouts(true)}
                variant="outline"
                disabled={processing || summary.eligible_creators === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Dry Run Preview
              </Button>

              <Button
                onClick={() => processPayouts(false)}
                className="bg-green-600 hover:bg-green-700"
                disabled={processing || summary.eligible_creators === 0}
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Process Payouts ({summary.eligible_creators} creators)
                  </>
                )}
              </Button>
            </div>

            {summary.eligible_creators === 0 && (
              <Alert className="mt-4">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  No creators are eligible for payout this month. Minimum threshold is {formatCurrency(summary.minimum_payout)}.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="detailed">Detailed View</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {batches.length > 0 ? (
                <div className="space-y-3">
                  {batches.map((batch) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 cursor-pointer"
                      onClick={() => setSelectedBatch(batch)}
                    >
                      <div className="flex items-center space-x-4">
                        {getStatusIcon(batch.processing_status)}
                        <div>
                          <div className="font-medium">
                            {formatDate(batch.batch_date)} Batch
                          </div>
                          <div className="text-sm text-gray-600">
                            {batch.total_creators_paid} creators • {formatCurrency(batch.total_amount_usd)}
                          </div>
                        </div>
                      </div>
                      <Badge className={getStatusColor(batch.processing_status)}>
                        {batch.processing_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Payout Batches</h3>
                  <p className="text-sm">Payout batches will appear here after processing</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="detailed">
              {selectedBatch ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">
                      Batch: {formatDate(selectedBatch.batch_date)}
                    </h3>
                    <Button
                      onClick={() => setSelectedBatch(null)}
                      variant="outline"
                      size="sm"
                    >
                      Back to Overview
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-xl font-bold">{selectedBatch.total_creators_paid}</div>
                      <div className="text-xs text-gray-600">Creators Paid</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-xl font-bold">{formatCurrency(selectedBatch.total_amount_usd)}</div>
                      <div className="text-xs text-gray-600">Total Amount</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-xl font-bold">{selectedBatch.processing_status}</div>
                      <div className="text-xs text-gray-600">Status</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-xl font-bold">{formatDate(selectedBatch.created_at)}</div>
                      <div className="text-xs text-gray-600">Processed</div>
                    </div>
                  </div>

                  {selectedBatch.individual_payouts && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Individual Payouts</h4>
                      {selectedBatch.individual_payouts.map((payout) => (
                        <div key={payout.id} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(payout.status)}
                            <div>
                              <div className="font-medium">{payout.creator_email}</div>
                              {payout.error_message && (
                                <div className="text-xs text-red-600">{payout.error_message}</div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(payout.amount_usd)}</div>
                            <div className="text-xs text-gray-500">
                              Net: {formatCurrency(payout.amount_usd - 0.25)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-sm">Select a batch from the overview to view details</div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Warning Notice */}
      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertTriangle className="w-4 h-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          <strong>Important:</strong> Always test with dry run first. Payouts are processed automatically on the 1st of each month.
          Processing fees of $0.25 per transfer are deducted from creator earnings.
        </AlertDescription>
      </Alert>
    </div>
  )
}