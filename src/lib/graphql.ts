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
  query AdminModules($includeInactive: Boolean) {
    adminModules(includeInactive: $includeInactive) {
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
      offerActive
      effectivePrice
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
        offerActive
        effectivePrice
      }
    }
  }
`;

export const ADMIN_PAYMENTS_QUERY = gql`
  query AdminPayments($status: String, $companyId: Int) {
    adminPayments(status: $status, companyId: $companyId) {
      paymentIntentId
      email
      modules
      amount
      currency
      status
      companyId
      companyName
      createdAt
      updatedAt
    }
  }
`;

export const ADMIN_UPDATE_PAYMENT_STATUS_MUTATION = gql`
  mutation AdminUpdatePaymentStatus($paymentIntentId: String!, $status: String!) {
    adminUpdatePaymentStatus(paymentIntentId: $paymentIntentId, status: $status) {
      success
      message
      payment {
        paymentIntentId
        status
      }
    }
  }
`;

export const ADMIN_COMPANIES_QUERY = gql`
  query AdminCompanies($search: String) {
    adminCompanies(search: $search) {
      id
      company
      activeModules
      createdAt
      isMultiLocationEnabled
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
