variable "project" {
  description = "Project name prefix for resources"
  type        = string
  default     = "servicelink-marketing"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Root domain for the site (e.g., marketing.example.com)"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN in us-east-1 for CloudFront"
  type        = string
}

