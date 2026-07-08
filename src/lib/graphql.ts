import { gql } from '@apollo/client';

export const TOKEN_AUTH_MUTATION = gql`
  mutation SuperAdminLogin($username: String!, $password: String!) {
    superAdminTokenAuth(username: $username, password: $password) {
      success
      message
      token
      expiresAt
      superAdmin {
        id
        username
        email
        isActive
        lastLogin
      }
    }
  }
`;

export const ADMIN_REVENUE_SUMMARY_QUERY = gql`
  query AdminRevenueSummary {
    adminRevenueSummary {
      totalCompanies
      totalUsers
      totalPayments
      grossRevenue
      byStatus {
        status
        count
        amount
      }
    }
  }
`;

export const ADMIN_MODULES_QUERY = gql`
  query AdminModules($includeInactive: Boolean, $search: String, $active: Boolean, $currency: String, $priceMin: Int, $priceMax: Int) {
    adminModules(
      includeInactive: $includeInactive
      search: $search
      active: $active
      currency: $currency
      priceMin: $priceMin
      priceMax: $priceMax
    ) {
      id
      name
      description
      price
      currency
      active
      sortOrder
      offerPrice
      offerLabel
      offerStartsAt
      offerEndsAt
      effectivePrice
      usersCount
      updatedAt
      updatedBy {
        id
        username
      }
    }
  }
`;

export const ADMIN_MODULE_DETAIL_QUERY = gql`
  query AdminModuleDetail($moduleId: String!) {
    adminModuleDetail(moduleId: $moduleId) {
      id
      name
      description
      price
      currency
      active
      sortOrder
      offerPrice
      offerLabel
      offerEndsAt
      users {
        id
        firstName
        lastName
        email
        username
      }
      logs {
        id
        action
        actor
        message
        createdAt
      }
    }
  }
`;

export const ADMIN_SAVE_MODULE_MUTATION = gql`
  mutation AdminSaveModule(
    $id: String!
    $name: String!
    $description: String
    $price: Int!
    $currency: String
    $active: Boolean
    $sortOrder: Int
  ) {
    adminSaveModule(
      id: $id
      name: $name
      description: $description
      price: $price
      currency: $currency
      active: $active
      sortOrder: $sortOrder
    ) {
      success
      message
      module {
        id
        name
        price
        active
        effectivePrice
      }
    }
  }
`;

export const ADMIN_SET_MODULE_OFFER_MUTATION = gql`
  mutation AdminSetModuleOffer(
    $id: String!
    $offerPrice: Int
    $offerLabel: String
    $offerStartsAt: DateTime
    $offerEndsAt: DateTime
    $clear: Boolean
  ) {
    adminSetModuleOffer(
      id: $id
      offerPrice: $offerPrice
      offerLabel: $offerLabel
      offerStartsAt: $offerStartsAt
      offerEndsAt: $offerEndsAt
      clear: $clear
    ) {
      success
      message
      module {
        id
        offerPrice
        effectivePrice
      }
    }
  }
`;

export const ADMIN_UPDATE_PAYMENT_STATUS_MUTATION = gql`
  mutation AdminUpdatePaymentStatus($paymentIntentId: String!, $status: String!, $reason: String) {
    adminUpdatePaymentStatus(paymentIntentId: $paymentIntentId, status: $status, reason: $reason) {
      success
      message
      payment {
        paymentIntentId
        status
      }
    }
  }
`;

export const ADMIN_REQUEST_REFUND_MUTATION = gql`
  mutation AdminRequestRefund($paymentIntentId: String!, $amount: Int, $reason: String) {
    adminRequestRefund(paymentIntentId: $paymentIntentId, amount: $amount, reason: $reason) {
      success
      message
      payment {
        paymentIntentId
        status
      }
    }
  }
`;

export const ADMIN_MANUAL_SUBSCRIPTION_MUTATION = gql`
  mutation AdminManualSubscriptionAction(
    $companyId: Int!
    $subscriptionId: String
    $source: String
    $paymentMethod: String
    $receiverMedium: String
    $senderMedium: String
    $gatewayPayload: String
    $reason: String
  ) {
    adminManualSubscriptionAction(
      companyId: $companyId
      subscriptionId: $subscriptionId
      source: $source
      paymentMethod: $paymentMethod
      receiverMedium: $receiverMedium
      senderMedium: $senderMedium
      gatewayPayload: $gatewayPayload
      reason: $reason
    ) {
      success
      message
      status
    }
  }
`;

export const ADMIN_COMPANIES_QUERY = gql`
  query AdminCompanies($search: String, $status: String, $subscriptionStatus: String, $dueDateFrom: DateTime, $dueDateTo: DateTime, $recurringDateFrom: DateTime, $recurringDateTo: DateTime) {
    adminCompanies(
      search: $search
      status: $status
      subscriptionStatus: $subscriptionStatus
      dueDateFrom: $dueDateFrom
      dueDateTo: $dueDateTo
      recurringDateFrom: $recurringDateFrom
      recurringDateTo: $recurringDateTo
    ) {
      id
      company
      activeModules
      latestPaymentModules
      createdAt
      isMultiLocationEnabled
      subscriptionStatus
      subscriptionDueDate
      subscriptionRecurringDate
      paymentHistoryCount
      latestPaymentStatus
      latestPaymentIntentId
      latestPaymentEmail
      latestPaymentAmount
      latestPaymentCurrency
      latestPaymentSource
      latestPaymentDeniedReason
      latestPaymentGatewayMethod
      latestPaymentGatewayRefReceiverMedium
      latestPaymentGatewayRefSenderMedium
      latestPaymentGatewayStatus
      latestPaymentCreatedAt
    }
  }
`;

export const ADMIN_COMPANY_PAYMENT_HISTORY_QUERY = gql`
  query AdminCompanyPaymentHistory($companyId: Int!, $dateFrom: DateTime, $dateTo: DateTime, $status: String) {
    adminCompanyPaymentHistory(companyId: $companyId, dateFrom: $dateFrom, dateTo: $dateTo, status: $status) {
      paymentIntentId
      email
      modules
      status
      amount
      currency
      companyId
      companyName
      source
      createdAt
      updatedAt
      dueDate
      recurringDate
      deniedReason
      gatewayMethod
      gatewayRefReceiverMedium
      gatewayRefSenderMedium
      gatewayPayload
      paymentGatewayStatus
    }
  }
`;

export const ADMIN_PAYMENTS_QUERY = gql`
  query AdminPayments($status: String, $companyId: Int, $dateFrom: DateTime, $dateTo: DateTime, $search: String) {
    adminPayments(status: $status, companyId: $companyId, dateFrom: $dateFrom, dateTo: $dateTo, search: $search) {
      paymentIntentId
      email
      modules
      amount
      currency
      status
      companyId
      companyName
      source
      deniedReason
      createdAt
      updatedAt
      dueDate
      recurringDate
      gatewayMethod
      gatewayRefReceiverMedium
      gatewayRefSenderMedium
      gatewayPayload
      paymentGatewayStatus
    }
  }
`;

export const ADMIN_UPDATE_COMPANY_DETAIL_MUTATION = gql`
  mutation AdminUpdateCompanyDetail(
    $companyId: Int!
    $company: String
    $status: String
    $subscriptionStatus: String
    $subscriptionDueDate: DateTime
    $subscriptionRecurringDate: DateTime
    $isMultiLocationEnabled: Boolean
  ) {
    adminUpdateCompanyDetail(
      companyId: $companyId
      company: $company
      status: $status
      subscriptionStatus: $subscriptionStatus
      subscriptionDueDate: $subscriptionDueDate
      subscriptionRecurringDate: $subscriptionRecurringDate
      isMultiLocationEnabled: $isMultiLocationEnabled
    ) {
      success
      message
      company {
        id
        company
        subscriptionStatus
        subscriptionDueDate
        subscriptionRecurringDate
        isMultiLocationEnabled
      }
    }
  }
`;

export const ADMIN_SET_COMPANY_MODULES_MUTATION = gql`
  mutation AdminSetCompanyModules($companyId: Int!, $modules: [String!]!) {
    adminSetCompanyModules(companyId: $companyId, modules: $modules) {
      success
      message
      company {
        id
        company
        activeModules
      }
    }
  }
`;

export const ADMIN_USERS_QUERY = gql`
  query AdminUsers($companyId: Int, $search: String) {
    adminUsers(companyId: $companyId, search: $search) {
      id
      username
      email
      firstName
      lastName
      isCompanyAdmin
      isActive
      company {
        id
        company
      }
      location {
        id
        location
      }
    }
  }
`;

export const ADMIN_UPDATE_USER_MUTATION = gql`
  mutation AdminUpdateUser(
    $userId: String!
    $firstName: String
    $lastName: String
    $email: String
    $username: String
    $isCompanyAdmin: Boolean
    $isActive: Boolean
    $locationId: Int
  ) {
    adminUpdateUser(
      userId: $userId
      firstName: $firstName
      lastName: $lastName
      email: $email
      username: $username
      isCompanyAdmin: $isCompanyAdmin
      isActive: $isActive
      locationId: $locationId
    ) {
      success
      message
      user {
        id
        firstName
        lastName
        email
        username
        isActive
        isCompanyAdmin
      }
    }
  }
`;

export const ADMIN_INFRASTRUCTURE_QUERY = gql`
  query AdminInfrastructure($period: String) {
    adminInfrastructure(period: $period) {
      income
      expense
      net
      period
      pendingBalance
      failedRefunds
      byDay {
        date
        income
        expense
      }
    }
  }
`;

export const ADMIN_ACTIVITY_LOG_QUERY = gql`
  query AdminUserActivityLogs(
    $from: DateTime
    $to: DateTime
    $action: String
    $companyId: Int
    $userId: ID
    $actor: String
  ) {
    adminUserActivityLogs(from: $from, to: $to, action: $action, companyId: $companyId, userId: $userId, actor: $actor) {
      id
      actor
      action
      targetType
      targetId
      companyId
      userId
      details
      createdAt
      ipAddress
      userAgent
      __typename
    }
  }
`;
