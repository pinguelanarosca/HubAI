import React from 'react';
import {
  Sparkles,
  Bot,
  Brain,
  Zap,
  Globe,
  Compass,
  Code,
  Cpu,
  User,
  Briefcase,
  Layers,
  Shield,
  Archive,
  Terminal,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Settings,
  Activity,
  Copy,
  Check,
  RefreshCw,
  Folder,
  Plus,
  Trash2,
  Edit2,
  Share2,
  Download,
  Info,
  Maximize2,
  Search,
  Play,
  X,
  GitCommit,
  FileText,
  FileCode,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  RotateCw
} from 'lucide-react';

export {
  Sparkles,
  Bot,
  Brain,
  Zap,
  Globe,
  Compass,
  Code,
  Cpu,
  User,
  Briefcase,
  Layers,
  Shield,
  Archive,
  Terminal,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Settings,
  Activity,
  Copy,
  Check,
  RefreshCw,
  Folder,
  Plus,
  Trash2,
  Edit2,
  Share2,
  Download,
  Info,
  Maximize2,
  Search,
  Play,
  X,
  GitCommit,
  FileText,
  FileCode,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  RotateCw
};

export const ProviderIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Bot,
  Brain,
  Zap,
  Globe,
  Compass,
  Code,
  Cpu,
  Terminal
};

export const AccountIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  Briefcase,
  Code,
  Brain,
  Sparkles,
  Layers,
  Cpu,
  Zap,
  Archive,
  User
};

export function getProviderIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ProviderIcons[iconName] || Bot;
}

export function getAccountIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return AccountIcons[iconName] || User;
}

