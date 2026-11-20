import { ArrowLeftRight } from 'lucide-react-native';
import { View } from 'react-native';

import { BookRow } from '@/components/book-row';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useMyLoans } from '@/hooks/use-loans';
import { dueLabel, isOverdue } from '@/lib/dates';
import type { Loan, WithId } from '@/types/model';

function Section({
  title,
  loans,
  render,
}: {
  title: string;
  loans: WithId<Loan>[];
  render: (l: WithId<Loan>) => React.ReactNode;
}) {
  if (!loans.length) return null;
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2 px-2 pb-1">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </Text>
        <Badge variant="secondary">
          <Text>{loans.length}</Text>
        </Badge>
      </View>
      {loans.map(render)}
    </View>
  );
}

export default function LoansScreen() {
  const { incomingRequests, lentOut, borrowed, loading } = useMyLoans();
  const empty = !incomingRequests.length && !lentOut.length && !borrowed.length;

  const dueBadge = (l: WithId<Loan>) => (
    <Badge variant={isOverdue(l.dueDate) ? 'destructive' : 'secondary'}>
      <Text>{dueLabel(l.dueDate)}</Text>
    </Badge>
  );

  return (
    <Screen safeBottom={false} header={<ScreenHeader large title="Loans" />}>
      {loading ? (
        <View className="gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </View>
      ) : empty ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No loans yet"
          description="Borrow requests, books you’ve lent out and books you’ve borrowed show up here."
        />
      ) : (
        <View className="gap-6">
          <Section
            title="Requests"
            loans={incomingRequests}
            render={(l) => (
              <BookRow
                key={l.id}
                title={l.title}
                authors={[]}
                coverUrl={l.coverUrl}
                meta={`${l.borrowerName} wants to borrow this`}
                badge={
                  <Badge variant="warning">
                    <Text>Requested</Text>
                  </Badge>
                }
              />
            )}
          />
          <Section
            title="Lent out"
            loans={lentOut}
            render={(l) => (
              <BookRow
                key={l.id}
                title={l.title}
                authors={[]}
                coverUrl={l.coverUrl}
                meta={`With ${l.borrowerName}`}
                badge={
                  l.status === 'returnPending' ? (
                    <Badge variant="warning">
                      <Text>Marked returned</Text>
                    </Badge>
                  ) : (
                    dueBadge(l)
                  )
                }
              />
            )}
          />
          <Section
            title="Borrowed"
            loans={borrowed}
            render={(l) => (
              <BookRow
                key={l.id}
                title={l.title}
                authors={[]}
                coverUrl={l.coverUrl}
                meta={`From ${l.ownerName}`}
                badge={
                  l.status === 'requested' ? (
                    <Badge variant="warning">
                      <Text>Requested</Text>
                    </Badge>
                  ) : (
                    dueBadge(l)
                  )
                }
              />
            )}
          />
          <Text className="px-2 text-center text-xs text-muted-foreground">
            Accept, decline, nudge and return actions are coming soon.
          </Text>
        </View>
      )}
    </Screen>
  );
}
