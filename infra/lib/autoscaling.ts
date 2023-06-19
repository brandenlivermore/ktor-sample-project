import { Construct } from 'constructs'
import * as cr from 'aws-cdk-lib/custom-resources'

type AutoScalingConfigurationProps = {
  /**
   * A name for the auto scaling configuration.
   * When you use it for the first time in an Amazon Web Services Region,
   * App Runner creates revision number 1 of this name.
   * When you use the same name in subsequent calls, App Runner creates incremental revisions of the configuration.
   */
  AutoScalingConfigurationName: string
  /**
   * The maximum number of concurrent requests that you want an instance to process.
   * If the number of concurrent requests exceeds this limit, App Runner scales up your service.
   * Default: 100
   */
  MaxConcurrency: number

  /**
   * The maximum number of instances that your service scales up to.
   * At most MaxSize instances actively serve traffic for your service.
   * Default: 25
   */
  MaxSize: number

  /**
   * The minimum number of instances that App Runner provisions for your service.
   * The service always has at least MinSize provisioned instances.
   * Some of them actively serve traffic. The rest of them (provisioned and inactive instances)
   * are a cost-effective compute capacity reserve and are ready to be quickly activated.
   * You pay for memory usage of all the provisioned instances. You pay for CPU usage of only the active subset.
   * App Runner temporarily doubles the number of provisioned instances during deployments,
   * to maintain the same capacity for both old and new code.
   * Default: 1
   */
  MinSize: number
}

export class AppRunnerAutoScaling extends Construct {
  /**
   * The Amazon Resource Name (ARN) of this auto scaling configuration.
   */
  arn: string

  /**
   * The customer-provided auto scaling configuration name. It can be used in multiple revisions of a configuration.
   */
  name: string

  /**
   * The revision of this auto scaling configuration.
   * It's unique among all the active configurations ("Status": "ACTIVE") that share the same AutoScalingConfigurationName.
   */
  revision: string
  
  /**
   * The current state of the auto scaling configuration.
   * If the status of a configuration revision is INACTIVE, it was deleted and can't be used.
   * Inactive configuration revisions are permanently removed some time after they are deleted.
   */
  status: 'ACTIVE' | 'INACTIVE'


  constructor(
    scope: Construct,
    id: string,
    props: AutoScalingConfigurationProps = { AutoScalingConfigurationName: `${id}-auto-scaling`, MaxConcurrency: 100, MaxSize: 25, MinSize: 1}
  ) {
    super(scope, id)

    const provider = new cr.AwsCustomResource(this, id, {
      installLatestAwsSdk: false,
      onUpdate: {
        service: 'AppRunner',
        action: 'createAutoScalingConfiguration',
        parameters: props,
        physicalResourceId: cr.PhysicalResourceId.fromResponse(
          'AutoScalingConfiguration.AutoScalingConfigurationArn'
        ),
      },
      onDelete: {
        service: 'AppRunner',
        action: 'deleteAutoScalingConfiguration',
        parameters: {
          AutoScalingConfigurationArn: new cr.PhysicalResourceIdReference(),
        },
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    })

    this.arn = provider.getResponseField(
      'AutoScalingConfiguration.AutoScalingConfigurationArn'
    )

    this.name = provider.getResponseField(
      'AutoScalingConfiguration.AutoScalingConfigurationName'
    )
    
    this.revision = provider.getResponseField(
      'AutoScalingConfiguration.AutoScalingConfigurationRevision'
    )
    
    this.status = provider.getResponseField(
      'AutoScalingConfiguration.Status'
    ) as 'ACTIVE' | 'INACTIVE'
  }
}